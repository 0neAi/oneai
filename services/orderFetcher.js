const cron = require('node-cron');
const BrokerOrder = require('../models/BrokerOrder');
const User = require('../models/User');
const BrokerCreditTransaction = require('../models/BrokerCreditTransaction');
const { getWebSocketServer } = require('../websocket');
const { trackOrder } = require('./trackingService');
const PathaoApiClient = require('./pathaoClient');

const DEFAULT_FETCH_INTERVAL_MINUTES = 15;
const DEFAULT_TRACK_INTERVAL_MINUTES = 5;
const DEFAULT_MORNING_FETCH_HOUR = 7;
const DEFAULT_EVENING_CLOSE_HOUR = 22;

function normalizeAgentStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');

  if (!status) return 'PENDING';
  if (['delivered', 'delivery completed', 'complete', 'completed'].includes(status)) return 'DELIVERED';
  if (['return', 'returned', 'returned by customer', 'return requested', 'returned to sender'].includes(status)) return 'RETURNED';
  if (['hold', 'on hold', 'onhold', 'holding', 'holded'].includes(status)) return 'HOLD';
  if (['cancelled', 'canceled', 'cancel'].includes(status)) return 'CANCELLED';
  if (['failed', 'failure', 'failed to deliver'].includes(status)) return 'FAILED';
  if (['pickup', 'picked up', 'on pickup', 'in pickup'].includes(status)) return 'PICKUP';
  if (['price change delivery', 'price change', 'price changed', 'price change requested'].includes(status)) return 'PENDING';
  return 'PENDING';
}

function getStartOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setMilliseconds(0);
  return value;
}

function holdCreditCostForTier(tier) {
  const normalized = String(tier || 'free').toLowerCase();
  switch (normalized) {
    case 'daily':
      return 0.8; // 20% discount
    case 'weekly':
      return 0.5; // 50% discount
    case 'monthly':
      return 0.3; // 70% discount
    default:
      return 1; // free tier: full price
  }
}

class OrderFetcher {
  constructor() {
    this.client = new PathaoApiClient();
    this.isFetching = false;
    this.isTracking = false;
    this.cronJobs = [];
  }

  async fetchFromAgents() {
    const agents = this.client.getActiveAgents();
    if (!agents.length) {
      console.warn('⚠️ No active Pathao agents configured');
      return [];
    }

    const orderMap = new Map();
    for (const agent of agents) {
      const agentOrders = await this.client.fetchAgentOrders(agent);
      if (!agentOrders.length) continue;

      const validOrders = agentOrders.filter((order) => order.orderId && String(order.orderId).trim());
      if (!validOrders.length) {
        console.warn(`⚠️ ${agent.displayName}: skipped orders without orderId`);
        continue;
      }

      for (const order of validOrders) {
        const key = String(order.orderId).trim();
        if (!orderMap.has(key)) {
          orderMap.set(key, order);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return Array.from(orderMap.values());
  }

  async deductHoldCarryOverCredits() {
    const today = getStartOfDay(new Date());
    const holdOrders = await BrokerOrder.find({
      status: 'HOLD',
      completed: false,
      $or: [
        { holdCreditDeductedAt: { $exists: false } },
        { holdCreditDeductedAt: { $lt: today } }
      ]
    });

    if (!holdOrders.length) {
      console.log('ℹ️ No hold orders eligible for carry-over deduction');
      return;
    }

    console.log(`🔁 Deducting carry-over credits for ${holdOrders.length} hold orders`);

    const users = new Map();
    const creditTransactions = [];
    const orderBulkOps = [];

    for (const order of holdOrders) {
      if (!order.user) {
        console.warn(`⚠️ Hold order ${order.orderId} has no linked user; skipping credit deduction`);
        continue;
      }

      const key = order.user.toString();
      let userState = users.get(key);
      if (!userState) {
        const user = await User.findById(order.user).select('brokerCredits brokerSubscriptionTier brokerUsageCount');
        if (!user) {
          console.warn(`⚠️ Hold order ${order.orderId} user not found; skipping deduction`);
          continue;
        }
        userState = { user, modified: false };
        users.set(key, userState);
      }

      const user = userState.user;
      const cost = holdCreditCostForTier(user.brokerSubscriptionTier);
      if (user.brokerCredits < cost) {
        console.warn(`⚠️ User ${user._id} has insufficient broker credits for hold carry-over on ${order.orderId}`);
        continue;
      }

      user.brokerCredits -= cost;
      user.brokerUsageCount = (user.brokerUsageCount || 0) + 1;
      userState.modified = true;
      creditTransactions.push({
        userId: user._id,
        type: 'usage',
        amount: cost,
        balance: user.brokerCredits,
        description: 'Hold order carry-over',
        orderId: order._id
      });

      orderBulkOps.push({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              holdCreditDeductedAt: today,
              updatedAt: new Date()
            }
          }
        }
      });
    }

    const saves = [];
    for (const [, state] of users) {
      if (state.modified) {
        saves.push(state.user.save());
      }
    }
    if (saves.length) {
      await Promise.all(saves);
    }

    if (creditTransactions.length) {
      await BrokerCreditTransaction.insertMany(creditTransactions, { ordered: false });
    }
    if (orderBulkOps.length) {
      await BrokerOrder.bulkWrite(orderBulkOps, { ordered: false });
    }

    console.log(`✅ Hold carry-over credit deduction completed for ${creditTransactions.length} orders`);
  }

  async upsertAgentOrders(orders) {
    if (!orders.length) {
      console.log('ℹ️ No agent orders were fetched to upsert');
      return { inserted: 0, modified: 0 };
    }

    const bulkOps = orders.map((order) => {
      const normalizedStatus = normalizeAgentStatus(order.status);
      return {
        updateOne: {
          filter: { orderId: order.orderId },
          update: {
            $set: {
              consignmentId: order.consignmentId,
              merchantName: order.merchantName,
              productDescription: order.productDescription,
              price: order.price,
              deliveryInstruction: order.deliveryInstruction,
              recipientName: order.recipientName,
              recipientPhone: order.recipientPhone,
              recipientAddress: order.recipientAddress,
              merchantPhone: order.merchantPhone,
              failedReason: order.failedReason,
              paymentLink: order.paymentLink,
              quantity: order.quantity,
              status: normalizedStatus,
              agentName: order.agentName,
              agentDisplayName: order.agentDisplayName,
              agentAssigned: order.agentAssigned,
              assigned: order.assigned,
              fetchedAt: new Date(),
              lastStatusUpdate: new Date(),
              lastStatusCheck: new Date(),
              updatedAt: new Date(),
              trackingEnabled: Boolean(order.consignmentId && order.recipientPhone),
              completed: ['DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED'].includes(normalizedStatus)
            },
            $setOnInsert: {
              orderId: order.orderId,
              createdAt: new Date(),
              statusHistory: [{
                status: normalizedStatus,
                note: 'Auto-fetched from Pathao',
                timestamp: new Date()
              }],
              holdCount: 0,
              holdReason: ''
            }
          },
          upsert: true
        }
      };
    });

    const result = await BrokerOrder.bulkWrite(bulkOps, { ordered: false });
    return {
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0
    };
  }

  async reconcileHoldOrders(fetchedOrders) {
    if (!fetchedOrders || !fetchedOrders.length) {
      return;
    }

    const fetchedMap = new Map(fetchedOrders.map((order) => [String(order.orderId).trim(), order]));
    const holdOrders = await BrokerOrder.find({ status: 'HOLD', completed: false });
    if (!holdOrders.length) return;

    const updates = [];
    for (const order of holdOrders) {
      const fetched = fetchedMap.get(String(order.orderId).trim());
      if (!fetched) continue;

      const normalizedStatus = normalizeAgentStatus(fetched.status);
      if (normalizedStatus === 'HOLD') continue;

      updates.push({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              status: normalizedStatus,
              holdCount: 0,
              holdReason: '',
              agentName: fetched.agentName,
              agentDisplayName: fetched.agentDisplayName,
              agentAssigned: fetched.agentAssigned,
              assigned: fetched.assigned,
              lastStatusUpdate: new Date(),
              updatedAt: new Date(),
              completed: ['DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED'].includes(normalizedStatus)
            },
            $push: {
              statusHistory: {
                status: normalizedStatus,
                note: 'Hold order reassigned after morning fetch',
                timestamp: new Date()
              }
            }
          }
        }
      });
    }

    if (updates.length) {
      await BrokerOrder.bulkWrite(updates, { ordered: false });
      console.log(`🔁 Reassigned ${updates.length} hold orders after fresh agent fetch`);
    }
  }

  async fetchAndStoreOrders() {
    if (this.isFetching) {
      console.log('⏳ Order fetch already running, skipping this cycle');
      return;
    }

    this.isFetching = true;
    try {
      console.log('🔄 Starting scheduled broker order fetch...');
      const fetchedOrders = await this.fetchFromAgents();
      const result = await this.upsertAgentOrders(fetchedOrders);
      console.log(`✅ Broker fetch complete: ${result.inserted} new, ${result.modified} updated`);
    } catch (error) {
      console.error('❌ Broker fetch error:', error.message || error);
    } finally {
      this.isFetching = false;
    }
  }

  async morningWorkflow() {
    if (this.isFetching) {
      console.log('⏳ Morning workflow already running, skipping this cycle');
      return;
    }

    this.isFetching = true;
    try {
      console.log('☀️  Starting morning broker workflow');
      await this.deductHoldCarryOverCredits();
      const fetchedOrders = await this.fetchFromAgents();
      const result = await this.upsertAgentOrders(fetchedOrders);
      await this.reconcileHoldOrders(fetchedOrders);
      console.log(`☀️  Morning broker workflow completed: ${result.inserted} new, ${result.modified} updated`);
    } catch (error) {
      console.error('❌ Morning workflow failed:', error.message || error);
    } finally {
      this.isFetching = false;
    }
  }

  async applyTrackingUpdate(order, trackingResult) {
    const updates = { lastStatusCheck: new Date(), updatedAt: new Date() };
    const statusChanged = trackingResult.status && trackingResult.status !== order.status;
    const completedStates = ['DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED'];

    if (trackingResult.status) {
      updates.status = trackingResult.status;
      if (completedStates.includes(trackingResult.status)) {
        updates.completed = true;
      } else {
        updates.completed = false;
      }
      if (trackingResult.status === 'HOLD') {
        updates.holdReason = trackingResult.holdReason || order.holdReason || 'Hold status received from public tracking';
      }
      updates.lastStatusUpdate = new Date();
    }

    const shouldPushHistory = statusChanged || (trackingResult.status === 'HOLD' && trackingResult.holdReason && trackingResult.holdReason !== order.holdReason);
    if (shouldPushHistory) {
      updates.$push = {
        statusHistory: {
          status: updates.status || order.status,
          note: statusChanged ? `Auto-tracked status update via public tracking` : `Hold reason updated via public tracking`,
          timestamp: new Date()
        }
      };
    }

    await BrokerOrder.updateOne({ _id: order._id }, updates);
    return updates.status || order.status;
  }

  async updateTrackedOrders() {
    if (this.isTracking) {
      console.log('⏳ Tracked order update already running, skipping');
      return;
    }

    this.isTracking = true;

    try {
      console.log('🔄 Checking tracked broker order status...');
      const trackedOrders = await BrokerOrder.find({
        trackingEnabled: true,
        status: { $in: ['PENDING', 'PICKUP', 'HOLD'] },
        completed: false
      });

      if (!trackedOrders.length) {
        console.log('ℹ️ No tracked broker orders to update');
        return;
      }

      let updatedCount = 0;
      for (const order of trackedOrders) {
        const trackingResult = await trackOrder(order.consignmentId, order.recipientPhone);
        if (!trackingResult.success) {
          console.warn(`⚠️ Tracking skip for ${order.orderId}: ${trackingResult.error}`);
          continue;
        }

        const updatedStatus = await this.applyTrackingUpdate(order, trackingResult);
        if (updatedStatus !== order.status) {
          updatedCount += 1;
          console.log(`📢 ${order.orderId}: ${order.status} → ${updatedStatus}`);

          const wss = getWebSocketServer();
          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && (!order.user || client.userID === order.user?.toString())) {
                client.send(JSON.stringify({
                  type: 'broker-order-updated',
                  order: {
                    ...order.toObject(),
                    status: updatedStatus,
                    lastStatusCheck: new Date(),
                    updatedAt: new Date()
                  }
                }));
              }
            });
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      console.log(`✅ Tracked broker orders updated: ${updatedCount}`);
    } catch (error) {
      console.error('❌ Tracked orders update error:', error.message || error);
    } finally {
      this.isTracking = false;
    }
  }

  async closingProcess() {
    console.log('🌙 Starting evening closing process for broker orders');
    try {
      await this.updateTrackedOrders();

      const activeOrders = await BrokerOrder.find({
        status: { $in: ['PENDING', 'PICKUP', 'HOLD'] },
        completed: false
      });

      if (!activeOrders.length) {
        console.log('ℹ️ No active broker orders to close for the day');
        return;
      }

      const closingOps = activeOrders.map((order) => ({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              status: 'HOLD',
              completed: false,
              holdCount: (order.holdCount || 0) + 1,
              lastStatusUpdate: new Date(),
              updatedAt: new Date(),
              assigned: Boolean(order.agentDisplayName || order.agentName)
            },
            $push: {
              statusHistory: {
                status: 'HOLD',
                note: 'Evening closing carry-over to next day',
                timestamp: new Date()
              }
            }
          }
        }
      }));

      const result = await BrokerOrder.bulkWrite(closingOps, { ordered: false });
      console.log(`🌙 Evening closing completed: ${result.modifiedCount || 0} orders moved to HOLD`);
    } catch (error) {
      console.error('❌ Evening closing process failed:', error.message || error);
    }
  }

  scheduleJobs() {
    const fetchHour = parseInt(process.env.MORNING_FETCH_HOUR, 10) || DEFAULT_MORNING_FETCH_HOUR;
    const trackMinutes = parseInt(process.env.ORDER_TRACK_INTERVAL_MINUTES, 10) || DEFAULT_TRACK_INTERVAL_MINUTES;
    const closeHour = parseInt(process.env.EVENING_CLOSE_HOUR, 10) || DEFAULT_EVENING_CLOSE_HOUR;
    const timezone = process.env.SCHEDULER_TIMEZONE || undefined;
    const options = timezone ? { timezone } : {};

    this.cronJobs.push(cron.schedule(`0 ${fetchHour} * * *`, () => {
      this.morningWorkflow().catch((error) => console.error('❌ Morning workflow cron failed:', error));
    }, options));

    this.cronJobs.push(cron.schedule(`*/${trackMinutes} * * * *`, () => {
      this.updateTrackedOrders().catch((error) => console.error('❌ Tracking cron failed:', error));
    }, options));

    this.cronJobs.push(cron.schedule(`0 ${closeHour} * * *`, () => {
      this.closingProcess().catch((error) => console.error('❌ Closing cron failed:', error));
    }, options));

    console.log(`⏰ Morning workflow scheduled for ${fetchHour}:00`);
    console.log(`⏰ Tracking workflow scheduled every ${trackMinutes} minutes`);
    console.log(`⏰ Evening closing scheduled for ${closeHour}:00`);
  }

  start() {
    this.scheduleJobs();

    if (process.env.RUN_ORDER_WORKFLOWS_ON_STARTUP !== 'false') {
      this.morningWorkflow().catch((error) => console.error('❌ Startup morning workflow failed:', error));
      this.updateTrackedOrders().catch((error) => console.error('❌ Startup tracking failed:', error));
    }
  }
}

module.exports = new OrderFetcher();
