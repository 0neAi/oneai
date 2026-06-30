# OneAI Compatible Update Blueprint

This document is a full implementation blueprint for the next update of the OneAI website. It is written to match the existing website logic, service structure, backend architecture, and user experience rather than introducing a disconnected feature.

## 1. Update Goal

Add a new premium feature called Data Broker / Order Management that fits naturally into the current OneAI ecosystem.

The new feature should:

- work inside the current dashboard experience
- use the existing user authentication and approval logic
- integrate with the current payment and premium-service flow
- use the current MongoDB + render backend style
- support real-time updates through the current WebSocket system
- remain visible to admins through the existing admin management structure

## 2. Website Logic to Preserve

The update must not break the existing website behavior. These current flows must remain fully intact:

1. User registration and login
   - Existing signup flow
   - Existing email/password validation
   - Admin approval gate before access

2. Dashboard experience
   - Current dashboard structure, stat cards, service buttons, and request history
   - Existing loading/error states and UI behavior

3. Payment and premium services
   - Existing premium service submission flow
   - Existing request tracking logic
   - Existing admin payment approval/rejection flow

4. Recharge and tracker services
   - Fexiload request flow
   - Location tracker request flow
   - Existing request history display

5. Admin control panel
   - Admin login and verification
   - User approval and moderation
   - Payment, issue, voucher, premium-service, and page management

## 3. Compatible Feature Scope

### A. Data Broker Dashboard Module

Add a new section to the dashboard named Data Broker or Order Management.

This module should include:

- pending orders list
- active tracking list
- completed and failed orders
- account balance / available credits
- subscription status
- action buttons for view, track, complete, or cancel

This should be implemented as part of the current dashboard flow rather than a separate standalone system.

### B. Order Management Flow

Users should be able to:

- view available orders from the backend
- see order details, status, merchant name, customer info, and timestamps
- track status history
- perform basic actions like accept, track, mark complete, or cancel

The workflow should follow the same pattern already used by the current service requests:

- user submits request
- backend validates access and balance
- backend saves the action or order state
- frontend refreshes the list and shows the updated result

### C. Credit-Based Access System

The feature should use a simple credit model that fits the existing premium-service style.

Suggested logic:

- each user has a broker credit balance
- one order access uses one credit
- users can purchase credits through the existing payment system
- users can also unlock access through a subscription tier

Suggested tiers:

- free: limited access
- daily: small number of order actions
- weekly: medium access
- monthly: large access

This should be stored in the user record and updated through backend rules.

### D. Subscription and Plan Handling

Add lightweight subscription logic tied to the user profile.

Recommended fields:

- brokerCredits
- brokerSubscriptionTier
- brokerSubscriptionExpiresAt
- brokerUsageCount
- brokerLastAccessedAt

This keeps the feature compatible with the existing user schema structure and avoids major changes to the current login and profile logic.

### E. Real-Time Updates

Real-time updates should follow the current WebSocket approach already used by the site.

When an order status changes, the backend should broadcast an event such as:

- new-order-assigned
- order-status-updated
- order-completed
- order-failed

The dashboard should listen for these events and refresh the relevant section without full page reload.

## 4. Backend Integration Plan

The update must be added to the current Express server in a way that matches the existing route style.

### Existing backend structure to follow

- use the current authentication middleware
- use the same response format as the other routes
- use the same error handling pattern
- use the same admin protection model for admin actions
- use WebSocket notifications for live updates

### Recommended backend routes

Add routes in the same style as the current server routes:

- GET /broker/orders
- GET /broker/orders/:id
- POST /broker/orders/:id/accept
- POST /broker/orders/:id/track
- POST /broker/orders/:id/complete
- POST /broker/orders/:id/cancel
- POST /broker/credits/purchase
- GET /broker/subscription/status
- GET /admin/broker-orders
- PUT /admin/broker-orders/:id/status

### Suggested data models

Create new models that follow the same pattern as the existing models:

- BrokerOrder
- BrokerCreditTransaction
- BrokerSubscriptionPlan

Each model should support:

- user reference
- order status
- timestamps
- history log
- admin notes
- status change reason

## 5. Frontend Integration Plan

The new feature should be implemented with the same frontend approach already used on the site:

- static HTML pages
- vanilla JavaScript
- shared CSS and existing dashboard layout
- existing loading animation and alert style
- current fetch-based API calls

### Recommended UI placement

- add a new service card on the dashboard for Data Broker
- create a dedicated page such as broker.html if needed
- or embed the feature inside the dashboard section for a smoother experience

### Frontend behavior

When a user clicks the Data Broker card:

1. check if the user is logged in
2. check if the user is approved
3. load current credits and subscription info
4. fetch available orders from the backend
5. show order cards with action buttons
6. update UI after each action

This matches the current website logic of the existing tracker and fexiload flows.

## 6. Admin Compatibility Plan

The update should be visible and manageable from the admin panel.

Admin should be able to:

- view all broker orders
- change order status
- review user credit usage
- monitor failed or cancelled orders
- manage subscription access if needed

This should follow the same admin pattern already used for payments, premium services, merchant issues, penalty reports, and page management.

## 7. Implementation Phases

### Phase 1: Backend Foundation

- add new models for orders and credits
- add user fields for broker access and credits
- add protected routes for broker actions
- connect the feature with the current auth and approval middleware

### Phase 2: Frontend Integration

- add the Data Broker card to the dashboard
- create the order management UI
- connect the new page to the backend API
- reuse the existing loading and error display patterns

### Phase 3: Real-Time Sync

- broadcast order updates through WebSocket
- update the dashboard view instantly
- notify users when status changes occur

### Phase 4: Admin Control

- add admin order review and status change screens
- add credit and usage reporting
- verify the new module works with the current admin panel structure

## 8. Compatibility Checklist

Before launch, confirm that:

- login and signup still work normally
- dashboard services still load correctly
- profile and voucher logic remain unaffected
- premium payment flow still works
- tracker and fexiload flows still work
- admin pages still work with the added module
- real-time updates do not break the existing WebSocket behavior

## 9. Final Implementation Rule

The Data Broker update should be treated as an extension of the current OneAI platform, not as a separate product. It should follow the website’s existing structure, user flow, backend style, and admin logic so that it feels like a native feature of the platform.


Additional detailed guides, use if you find it necessary:
new update feature implementation blueprint:

# 🚀 **DATA BROKER FEATURE - COMPLETE BLUEPRINT FOR IMPLEMENTATION**

## **Professional Prompt for Copilot/Claude to Build a Full-Featured Order Management Dashboard**

---

### **PROJECT CONTEXT**

I have an existing GitHub Pages website with a **TRX-based payment system** integrated with Render backend and MongoDB database. I need to implement a new premium feature called **"Data Broker"** that allows users to:

1. **Pull and display pending orders** from multiple Pathao delivery agents
2. **Manage, sort, filter, and track** orders in real-time
3. **Monitor order status** with automatic updates
4. **Use a credit-based subscription system** where users pay per consignment
5. **Receive notifications** for order status changes

---

## **📋 COMPLETE BLUEPRINT FOR IMPLEMENTATION**

### **1. SYSTEM ARCHITECTURE**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA BROKER SYSTEM ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────────┐   │
│  │   GitHub Pages   │    │    Render API    │    │    MongoDB Atlas   │   │
│  │    (Frontend)    │◄──►│   (Backend)      │◄──►│    (Database)      │   │
│  │                  │    │                  │    │                     │   │
│  │  - Dashboard UI  │    │  - Auth/TRX      │    │  - Orders          │   │
│  │  - Real-time     │    │  - Order Fetch   │    │  - Users           │   │
│  │  - Filters       │    │  - Credits       │    │  - Transactions    │   │
│  │  - Tracking      │    │  - Webhooks      │    │  - Tracking        │   │
│  └──────────────────┘    └──────────────────┘    └────────────────────┘   │
│           │                        │                         │              │
│           │                        ▼                         │              │
│           │    ┌─────────────────────────────────────┐       │              │
│           └────►│      Pathao API (Agents)           │◄──────┘              │
│                │  - Fetch Orders                     │                      │
│                │  - Track Status                     │                      │
│                │  - Update Notifications             │                      │
│                └─────────────────────────────────────┘                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    TRX Payment System Integration                   │   │
│  │                                                                     │   │
│  │  User Wallet → Purchase Credits → Use Credits → Track Consignments │   │
│  │                                                                     │   │
│  │  Pricing Structure:                                                 │   │
│  │  • Daily: $1 = 10 consignments ($0.10/ea)                         │   │
│  │  • Weekly: $1 = 25 consignments ($0.04/ea)                        │   │
│  │  • Monthly: $1 = 33 consignments ($0.03/ea)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### **2. MONGODB DATABASE SCHEMA**

```javascript
// ============================================
// MongoDB Collections for Data Broker Feature
// ============================================

// 1. Users Collection (Enhanced)
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name", "createdAt"],
      properties: {
        _id: { bsonType: "objectId" },
        email: { bsonType: "string" },
        name: { bsonType: "string" },
        walletAddress: { bsonType: "string" }, // TRX wallet
        credits: { bsonType: "double", minimum: 0, default: 0 },
        subscriptionTier: { 
          bsonType: "string", 
          enum: ["free", "daily", "weekly", "monthly"],
          default: "free"
        },
        subscriptionExpiresAt: { bsonType: "date" },
        totalConsignments: { bsonType: "int", default: 0 },
        trackingLimit: { bsonType: "int", default: 5 }, // Max orders to track
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// 2. Orders Collection
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["orderId", "merchantName", "status", "fetchedAt"],
      properties: {
        _id: { bsonType: "objectId" },
        orderId: { bsonType: "string" },
        consignmentId: { bsonType: "string" },
        merchantName: { bsonType: "string" },
        productDescription: { bsonType: "string" },
        price: { bsonType: "double" },
        deliveryInstruction: { bsonType: "string" },
        recipientName: { bsonType: "string" },
        recipientPhone: { bsonType: "string" },
        agentName: { bsonType: "string" }, // Internal
        agentDisplayName: { bsonType: "string" }, // User-facing
        recipientAddress: { bsonType: "string" },
        merchantPhone: { bsonType: "string" },
        failedReason: { bsonType: "string" },
        paymentLink: { bsonType: "string" },
        quantity: { bsonType: "int", default: 1 },
        status: { 
          bsonType: "string",
          enum: ["PENDING", "PICKUP", "DELIVERED", "CANCELLED", "FAILED", "RETURNED"]
        },
        trackingEnabled: { bsonType: "bool", default: false },
        lastStatusCheck: { bsonType: "date" },
        statusHistory: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              status: { bsonType: "string" },
              timestamp: { bsonType: "date" },
              note: { bsonType: "string" }
            }
          }
        },
        fetchedAt: { bsonType: "date" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// 3. Credits Transactions Collection
db.createCollection("credit_transactions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "type", "amount", "timestamp"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        type: { 
          bsonType: "string",
          enum: ["purchase", "usage", "refund", "bonus", "expiry"]
        },
        amount: { bsonType: "double" },
        balance: { bsonType: "double" }, // New balance after transaction
        subscriptionTier: { bsonType: "string" },
        description: { bsonType: "string" },
        orderId: { bsonType: "objectId" },
        transactionHash: { bsonType: "string" }, // TRX tx hash
        timestamp: { bsonType: "date" }
      }
    }
  }
});

// 4. Tracking Events Collection
db.createCollection("tracking_events", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["orderId", "eventType", "timestamp"],
      properties: {
        _id: { bsonType: "objectId" },
        orderId: { bsonType: "objectId" },
        eventType: { 
          bsonType: "string",
          enum: ["status_change", "delivery_attempt", "customer_contact", "return_initiated"]
        },
        oldStatus: { bsonType: "string" },
        newStatus: { bsonType: "string" },
        note: { bsonType: "string" },
        metadata: { bsonType: "object" },
        timestamp: { bsonType: "date" },
        notified: { bsonType: "bool", default: false }
      }
    }
  }
});

// 5. Price Rules Collection
db.createCollection("price_rules", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "tier", "creditsPerDollar", "bonusCredits", "active"],
      properties: {
        _id: { bsonType: "objectId" },
        name: { bsonType: "string" },
        tier: { bsonType: "string", enum: ["daily", "weekly", "monthly"] },
        creditsPerDollar: { bsonType: "int" }, // Credits received per $1
        bonusCredits: { bsonType: "int", default: 0 },
        maxTrackingOrders: { bsonType: "int" }, // Max orders user can track
        price: { bsonType: "double" }, // Price in USD
        active: { bsonType: "bool", default: true },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// ============================================
// Indexes for Performance
// ============================================

// Orders Collection Indexes
db.orders.createIndex({ orderId: 1 }, { unique: true });
db.orders.createIndex({ userId: 1, createdAt: -1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ merchantName: "text", productDescription: "text", recipientName: "text" });
db.orders.createIndex({ trackingEnabled: 1, lastStatusCheck: 1 });

// Users Collection Indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ walletAddress: 1 });

// Credit Transactions Indexes
db.credit_transactions.createIndex({ userId: 1, timestamp: -1 });
```

---

### **3. RENDER BACKEND API (NODE.JS/EXPRESS)**

```javascript
// ============================================
// server.js - Complete Data Broker Backend API
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware Configuration
// ============================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://api-hermes.pathao.com", "https://api.trongrid.io"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
}));

app.use(cors({
  origin: ['https://your-github-pages-domain.github.io', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// ============================================
// MongoDB Connection
// ============================================

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('✅ Connected to MongoDB Atlas');
  initializePriceRules();
});

// ============================================
// Mongoose Schemas
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  walletAddress: { type: String, unique: true, sparse: true },
  credits: { type: Number, default: 0 },
  subscriptionTier: { 
    type: String, 
    enum: ['free', 'daily', 'weekly', 'monthly'],
    default: 'free'
  },
  subscriptionExpiresAt: { type: Date },
  totalConsignments: { type: Number, default: 0 },
  trackingLimit: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderId: { type: String, required: true, unique: true },
  consignmentId: { type: String },
  merchantName: { type: String, required: true },
  productDescription: { type: String },
  price: { type: Number },
  deliveryInstruction: { type: String },
  recipientName: { type: String },
  recipientPhone: { type: String },
  agentName: { type: String },
  agentDisplayName: { type: String },
  recipientAddress: { type: String },
  merchantPhone: { type: String },
  failedReason: { type: String },
  paymentLink: { type: String },
  quantity: { type: Number, default: 1 },
  status: { 
    type: String, 
    enum: ['PENDING', 'PICKUP', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED'],
    default: 'PENDING'
  },
  trackingEnabled: { type: Boolean, default: false },
  lastStatusCheck: { type: Date },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String
  }],
  fetchedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Credit Transaction Schema
const creditTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['purchase', 'usage', 'refund', 'bonus', 'expiry'],
    required: true 
  },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true },
  subscriptionTier: { type: String },
  description: { type: String },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  transactionHash: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// Tracking Event Schema
const trackingEventSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  eventType: { 
    type: String, 
    enum: ['status_change', 'delivery_attempt', 'customer_contact', 'return_initiated'],
    required: true 
  },
  oldStatus: { type: String },
  newStatus: { type: String },
  note: { type: String },
  metadata: { type: Object },
  timestamp: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false }
});

// Price Rule Schema
const priceRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tier: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  creditsPerDollar: { type: Number, required: true },
  bonusCredits: { type: Number, default: 0 },
  maxTrackingOrders: { type: Number, required: true },
  price: { type: Number, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create Models
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);
const TrackingEvent = mongoose.model('TrackingEvent', trackingEventSchema);
const PriceRule = mongoose.model('PriceRule', priceRuleSchema);

// ============================================
// Pathao API Client (Hidden Agent Logic)
// ============================================

class PathaoApiClient {
  constructor() {
    this.baseUrl = 'https://api-hermes.pathao.com';
    this.clientId = process.env.PATHAO_CLIENT_ID || '1';
    this.clientSecret = process.env.PATHAO_CLIENT_SECRET;
    
    // Agent credentials (NEVER exposed to frontend)
    this.agents = [
      {
        id: 'agent_001',
        displayName: 'Alpha Courier',
        username: process.env.AGENT1_USERNAME,
        password: process.env.AGENT1_PASSWORD,
        isActive: true
      },
      {
        id: 'agent_002',
        displayName: 'Beta Express',
        username: process.env.AGENT2_USERNAME,
        password: process.env.AGENT2_PASSWORD,
        isActive: true
      },
      {
        id: 'agent_003',
        displayName: 'Gamma Logistics',
        username: process.env.AGENT3_USERNAME,
        password: process.env.AGENT3_PASSWORD,
        isActive: true
      },
      {
        id: 'agent_004',
        displayName: 'Delta Delivery',
        username: process.env.AGENT4_USERNAME,
        password: process.env.AGENT4_PASSWORD,
        isActive: true
      },
      {
        id: 'agent_005',
        displayName: 'Epsilon Cargo',
        username: process.env.AGENT5_USERNAME,
        password: process.env.AGENT5_PASSWORD,
        isActive: true
      },
      {
        id: 'agent_006',
        displayName: 'Zeta Dispatch',
        username: process.env.AGENT6_USERNAME,
        password: process.env.AGENT6_PASSWORD,
        isActive: true
      }
    ];
    
    this.tokens = {};
  }

  async loginAgent(agent) {
    try {
      const response = await axios.post(`${this.baseUrl}/talaria/api/v1/issue-token`, {
        username: agent.username,
        password: agent.password,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'password'
      }, {
        headers: {
          'Accept': 'application/json',
          'X-Country-Id': '1',
          'App-Version': '7.1.0',
          'User-Agent': 'okhttp/4.9.2',
          'Content-Type': 'application/json;charset=utf-8'
        }
      });

      if (response.data && response.data.data && response.data.data.access_token) {
        const token = response.data.data.access_token;
        this.tokens[agent.id] = {
          token: token,
          expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000) // 23 hours
        };
        console.log(`✅ Agent ${agent.displayName} logged in successfully`);
        return token;
      }
      return null;
    } catch (error) {
      console.error(`❌ Agent ${agent.displayName} login failed:`, error.message);
      return null;
    }
  }

  async fetchAgentOrders(agent) {
    try {
      // Check token validity
      let tokenInfo = this.tokens[agent.id];
      if (!tokenInfo || new Date(tokenInfo.expiresAt) < new Date()) {
        tokenInfo = await this.loginAgent(agent);
        if (!tokenInfo) return [];
      }

      const token = typeof tokenInfo === 'string' ? tokenInfo : tokenInfo.token;

      const response = await axios.get(`${this.baseUrl}/talaria/api/v1/user/delivery`, {
        params: { page: 1, limit: 1000 },
        headers: {
          'Accept': 'application/json',
          'App-Version': '7.1.0',
          'Authorization': `Bearer ${token}`,
          'X-Country-Id': '1',
          'User-Agent': 'okhttp/4.9.2'
        }
      });

      if (response.status === 200 && response.data) {
        const orders = this.extractOrders(response.data);
        
        // Add agent info
        return orders.map(order => ({
          ...order,
          agentName: agent.id,
          agentDisplayName: agent.displayName
        }));
      }
      return [];
    } catch (error) {
      console.error(`❌ Agent ${agent.displayName} fetch error:`, error.message);
      return [];
    }
  }

  extractOrders(data) {
    if (!data) return [];
    
    const orders = data.data?.orders?.data || 
                  data.data?.orders || 
                  data.orders || 
                  [];
    
    // Map to standard format
    return orders.map(order => ({
      orderId: order.order_id || order.id,
      consignmentId: order.consignment_id || order.consignmentId,
      merchantName: order.merchant_name || order.merchantName || '',
      productDescription: order.order_desc || order.productDescription || '',
      price: parseFloat(order.amount || order.price || 0),
      deliveryInstruction: order.delivery_instruction || order.deliveryInstruction || '',
      recipientName: order.recipient_name || order.recipientName || '',
      recipientPhone: order.recipient_phone || order.recipientPhone || '',
      recipientAddress: order.recipient_address || order.recipientAddress || '',
      merchantPhone: order.merchant_phone || order.merchantPhone || '',
      failedReason: order.failed_reason || order.failedReason || '',
      paymentLink: order.payment_link || order.paymentLink || '',
      quantity: parseInt(order.quantity || 1),
      status: order.status || 'PENDING'
    }));
  }

  async fetchAllPendingOrders() {
    console.log('🔄 Fetching pending orders from all agents...');
    const allOrders = [];
    
    for (const agent of this.agents) {
      if (!agent.isActive) continue;
      
      try {
        const orders = await this.fetchAgentOrders(agent);
        const pending = orders.filter(o => o.status === 'PENDING');
        
        // Add agent display name (hide actual agent name)
        pending.forEach(order => {
          order.agentDisplayName = agent.displayName;
          order.agentName = agent.id; // Internal reference
        });
        
        allOrders.push(...pending);
        console.log(`📌 ${agent.displayName}: ${pending.length} pending orders`);
        
        // Rate limiting between agents
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error fetching from ${agent.displayName}:`, error.message);
      }
    }
    
    console.log(`📊 TOTAL PENDING ORDERS FETCHED: ${allOrders.length}`);
    return allOrders;
  }

  async trackOrderStatus(consignmentId, orderId) {
    // Track specific order status using the link: ptho.app/xxxxxx
    // This would involve additional API calls to get order details
    try {
      // Use any available agent to check status
      const activeAgent = this.agents.find(a => a.isActive);
      if (!activeAgent) return null;
      
      // Check token
      let tokenInfo = this.tokens[activeAgent.id];
      if (!tokenInfo || new Date(tokenInfo.expiresAt) < new Date()) {
        tokenInfo = await this.loginAgent(activeAgent);
        if (!tokenInfo) return null;
      }
      
      const token = typeof tokenInfo === 'string' ? tokenInfo : tokenInfo.token;
      
      // Fetch specific order status
      const response = await axios.get(`${this.baseUrl}/talaria/api/v1/order/${orderId}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Country-Id': '1'
        }
      });
      
      if (response.status === 200) {
        return {
          status: response.data.data?.status || 'PENDING',
          updatedAt: new Date()
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Order tracking error:', error.message);
      return null;
    }
  }
}

// ============================================
// TRX Payment Integration
// ============================================

class TrxPaymentProcessor {
  constructor() {
    this.trongridApi = 'https://api.trongrid.io';
    this.contractAddress = process.env.TRX_CONTRACT_ADDRESS;
    this.walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
  }

  async verifyTransaction(txHash, expectedAmount, userWallet) {
    try {
      // Verify TRX transaction on blockchain
      const response = await axios.get(`${this.trongridApi}/v1/transactions/${txHash}`);
      
      if (response.data && response.data.data) {
        const tx = response.data.data[0];
        
        // Check if transaction is successful
        if (tx.contractResult !== 'SUCCESS') return { valid: false, reason: 'Transaction failed' };
        
        // Verify recipient address matches our wallet
        const toAddress = tx.raw_data.contract[0].parameter.value.to_address;
        if (toAddress !== this.contractAddress) {
          return { valid: false, reason: 'Invalid recipient address' };
        }
        
        // Verify amount
        const amount = tx.raw_data.contract[0].parameter.value.amount / 1000000; // Convert from SUN to TRX
        if (amount < expectedAmount) {
          return { valid: false, reason: 'Insufficient amount sent' };
        }
        
        // Verify sender wallet matches user's wallet
        const fromAddress = tx.raw_data.contract[0].parameter.value.owner_address;
        if (fromAddress !== userWallet) {
          return { valid: false, reason: 'Sender wallet mismatch' };
        }
        
        return { valid: true, amount: amount };
      }
      
      return { valid: false, reason: 'Transaction not found' };
    } catch (error) {
      console.error('❌ Transaction verification error:', error.message);
      return { valid: false, reason: 'Verification error' };
    }
  }

  async processPayment(userId, amount, subscriptionTier, txHash) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Get user
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get price rules
      const priceRule = await PriceRule.findOne({ 
        tier: subscriptionTier, 
        active: true 
      }).session(session);
      
      if (!priceRule) {
        throw new Error('Invalid subscription tier');
      }
      
      // Calculate credits
      const credits = amount * priceRule.creditsPerDollar + priceRule.bonusCredits;
      
      // Update user
      user.credits += credits;
      user.subscriptionTier = subscriptionTier;
      user.subscriptionExpiresAt = new Date(Date.now() + this.getTierDuration(subscriptionTier));
      user.totalConsignments += Math.floor(credits / 0.05); // Estimate
      user.updatedAt = new Date();
      
      await user.save({ session });
      
      // Create transaction record
      const transaction = new CreditTransaction({
        userId: user._id,
        type: 'purchase',
        amount: credits,
        balance: user.credits,
        subscriptionTier: subscriptionTier,
        description: `Purchased ${credits} credits with ${subscriptionTier} subscription`,
        transactionHash: txHash,
        timestamp: new Date()
      });
      
      await transaction.save({ session });
      
      await session.commitTransaction();
      
      return {
        success: true,
        credits: credits,
        newBalance: user.credits,
        subscriptionTier: user.subscriptionTier,
        expiresAt: user.subscriptionExpiresAt
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ Payment processing error:', error.message);
      throw error;
    } finally {
      session.endSession();
    }
  }

  getTierDuration(tier) {
    switch(tier) {
      case 'daily': return 24 * 60 * 60 * 1000;
      case 'weekly': return 7 * 24 * 60 * 60 * 1000;
      case 'monthly': return 30 * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }
}

// ============================================
// Credit Management Service
// ============================================

class CreditManagementService {
  async deductCredit(userId, orderId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error('User not found');
      
      // Check if user has enough credits
      const costPerOrder = this.getCostPerOrder(user.subscriptionTier);
      if (user.credits < costPerOrder) {
        throw new Error(`Insufficient credits. Need ${costPerOrder} credits, have ${user.credits}`);
      }
      
      // Deduct credits
      user.credits -= costPerOrder;
      user.totalConsignments += 1;
      user.updatedAt = new Date();
      
      await user.save({ session });
      
      // Create transaction record
      const transaction = new CreditTransaction({
        userId: user._id,
        type: 'usage',
        amount: -costPerOrder,
        balance: user.credits,
        orderId: orderId,
        description: `Used ${costPerOrder} credits to fetch order`,
        timestamp: new Date()
      });
      
      await transaction.save({ session });
      
      await session.commitTransaction();
      
      return {
        success: true,
        remainingCredits: user.credits,
        cost: costPerOrder,
        orderId: orderId
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ Credit deduction error:', error.message);
      throw error;
    } finally {
      session.endSession();
    }
  }

  getCostPerOrder(tier) {
    // Pricing: 0.05 - 0.15 per consignment based on subscription
    switch(tier) {
      case 'daily': return 0.10; // $0.10 per order
      case 'weekly': return 0.04; // $0.04 per order ($1=25 credits)
      case 'monthly': return 0.03; // $0.03 per order ($1=33 credits)
      default: return 0.15; // Free tier
    }
  }

  async checkUserCredits(userId) {
    const user = await User.findById(userId);
    if (!user) return { error: 'User not found' };
    
    return {
      credits: user.credits,
      tier: user.subscriptionTier,
      expiresAt: user.subscriptionExpiresAt,
      totalConsignments: user.totalConsignments,
      costPerOrder: this.getCostPerOrder(user.subscriptionTier),
      estimatedOrders: Math.floor(user.credits / this.getCostPerOrder(user.subscriptionTier))
    };
  }
}

// ============================================
// Order Management Service
// ============================================

class OrderManagementService {
  constructor() {
    this.pathaoClient = new PathaoApiClient();
    this.creditService = new CreditManagementService();
  }

  async fetchAndStoreOrders(userId) {
    try {
      // Check user credits first
      const creditInfo = await this.creditService.checkUserCredits(userId);
      if (creditInfo.error) throw new Error(creditInfo.error);
      
      if (creditInfo.credits < this.creditService.getCostPerOrder(creditInfo.tier)) {
        throw new Error('Insufficient credits. Please purchase more.');
      }
      
      // Fetch orders from Pathao
      const orders = await this.pathaoClient.fetchAllPendingOrders();
      
      if (orders.length === 0) {
        return { success: true, message: 'No pending orders found', count: 0 };
      }
      
      // Deduct credits per order (limit to available credits)
      const costPerOrder = this.creditService.getCostPerOrder(creditInfo.tier);
      const maxOrders = Math.floor(creditInfo.credits / costPerOrder);
      const ordersToFetch = orders.slice(0, maxOrders);
      
      let savedCount = 0;
      let updatedCount = 0;
      
      for (const orderData of ordersToFetch) {
        // Check if order already exists
        const existingOrder = await Order.findOne({ orderId: orderData.orderId });
        
        if (existingOrder) {
          // Update existing order
          existingOrder.merchantName = orderData.merchantName || existingOrder.merchantName;
          existingOrder.productDescription = orderData.productDescription || existingOrder.productDescription;
          existingOrder.price = orderData.price || existingOrder.price;
          existingOrder.recipientName = orderData.recipientName || existingOrder.recipientName;
          existingOrder.recipientPhone = orderData.recipientPhone || existingOrder.recipientPhone;
          existingOrder.agentDisplayName = orderData.agentDisplayName || existingOrder.agentDisplayName;
          existingOrder.recipientAddress = orderData.recipientAddress || existingOrder.recipientAddress;
          existingOrder.merchantPhone = orderData.merchantPhone || existingOrder.merchantPhone;
          existingOrder.failedReason = orderData.failedReason || existingOrder.failedReason;
          existingOrder.paymentLink = orderData.paymentLink || existingOrder.paymentLink;
          existingOrder.quantity = orderData.quantity || existingOrder.quantity;
          existingOrder.updatedAt = new Date();
          
          await existingOrder.save();
          updatedCount++;
        } else {
          // Create new order
          const newOrder = new Order({
            userId: userId,
            orderId: orderData.orderId,
            consignmentId: orderData.consignmentId,
            merchantName: orderData.merchantName,
            productDescription: orderData.productDescription,
            price: orderData.price,
            deliveryInstruction: orderData.deliveryInstruction,
            recipientName: orderData.recipientName,
            recipientPhone: orderData.recipientPhone,
            agentName: orderData.agentName,
            agentDisplayName: orderData.agentDisplayName,
            recipientAddress: orderData.recipientAddress,
            merchantPhone: orderData.merchantPhone,
            failedReason: orderData.failedReason,
            paymentLink: orderData.paymentLink,
            quantity: orderData.quantity,
            status: orderData.status || 'PENDING',
            fetchedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          await newOrder.save();
          savedCount++;
        }
      }
      
      // Deduct credits for all saved orders
      const totalCreditsUsed = (savedCount + updatedCount) * costPerOrder;
      await this.creditService.deductCredit(userId, null, totalCreditsUsed);
      
      return {
        success: true,
        saved: savedCount,
        updated: updatedCount,
        total: ordersToFetch.length,
        creditsUsed: totalCreditsUsed,
        remainingCredits: (await this.creditService.checkUserCredits(userId)).credits
      };
      
    } catch (error) {
      console.error('❌ Order fetch error:', error.message);
      throw error;
    }
  }

  async getOrders(userId, filters = {}) {
    try {
      const query = { userId: userId };
      
      // Apply filters
      if (filters.status) query.status = filters.status;
      if (filters.merchantName) {
        query.merchantName = { $regex: filters.merchantName, $options: 'i' };
      }
      if (filters.recipientName) {
        query.recipientName = { $regex: filters.recipientName, $options: 'i' };
      }
      if (filters.agentName) query.agentDisplayName = filters.agentName;
      if (filters.trackingEnabled !== undefined) query.trackingEnabled = filters.trackingEnabled;
      
      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }
      
      // Price range filter
      if (filters.minPrice || filters.maxPrice) {
        query.price = {};
        if (filters.minPrice) query.price.$gte = parseFloat(filters.minPrice);
        if (filters.maxPrice) query.price.$lte = parseFloat(filters.maxPrice);
      }
      
      // Search
      if (filters.search) {
        query.$or = [
          { merchantName: { $regex: filters.search, $options: 'i' } },
          { productDescription: { $regex: filters.search, $options: 'i' } },
          { recipientName: { $regex: filters.search, $options: 'i' } },
          { recipientAddress: { $regex: filters.search, $options: 'i' } },
          { consignmentId: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Sorting
      const sortOptions = {};
      const sortField = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'desc';
      sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;
      
      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Execute query
      const orders = await Order.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();
      
      const total = await Order.countDocuments(query);
      
      // Track status for orders if tracking is enabled
      const trackedOrders = orders.filter(o => o.trackingEnabled);
      for (const order of trackedOrders) {
        // Update status if needed (async)
        this.updateOrderStatusIfNeeded(order);
      }
      
      return {
        orders: orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('❌ Get orders error:', error.message);
      throw error;
    }
  }

  async updateOrderStatusIfNeeded(order) {
    // Check if status needs updating (every 5 minutes for tracked orders)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!order.lastStatusCheck || order.lastStatusCheck < fiveMinutesAgo) {
      try {
        const pathaoClient = new PathaoApiClient();
        const statusInfo = await pathaoClient.trackOrderStatus(
          order.consignmentId,
          order.orderId
        );
        
        if (statusInfo && statusInfo.status !== order.status) {
          // Status changed - update and create event
          order.status = statusInfo.status;
          order.lastStatusCheck = new Date();
          order.updatedAt = new Date();
          
          // Add to status history
          if (!order.statusHistory) order.statusHistory = [];
          order.statusHistory.push({
            status: statusInfo.status,
            timestamp: new Date(),
            note: 'Auto-tracked status update'
          });
          
          // Create tracking event
          const trackingEvent = new TrackingEvent({
            orderId: order._id,
            eventType: 'status_change',
            oldStatus: order.status,
            newStatus: statusInfo.status,
            timestamp: new Date(),
            notified: false
          });
          
          await trackingEvent.save();
          await order.save();
        }
      } catch (error) {
        console.error('❌ Status update error for order:', order.orderId, error.message);
      }
    }
  }

  async toggleTracking(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) throw new Error('Order not found');
    
    // Check user's tracking limit
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    if (!order.trackingEnabled) {
      // Enable tracking - check limit
      const trackedCount = await Order.countDocuments({
        userId: userId,
        trackingEnabled: true
      });
      
      if (trackedCount >= user.trackingLimit) {
        throw new Error(`Tracking limit reached (${user.trackingLimit}). Upgrade to track more.`);
      }
      
      order.trackingEnabled = true;
      order.lastStatusCheck = new Date();
    } else {
      // Disable tracking
      order.trackingEnabled = false;
    }
    
    order.updatedAt = new Date();
    await order.save();
    
    return order;
  }

  async getTrackingEvents(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) throw new Error('Order not found');
    
    const events = await TrackingEvent.find({ orderId: orderId })
      .sort({ timestamp: -1 })
      .lean();
    
    return events;
  }

  async getAnalytics(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');
      
      const orders = await Order.find({ userId: userId });
      
      // Status distribution
      const statusDistribution = {};
      orders.forEach(order => {
        statusDistribution[order.status] = (statusDistribution[order.status] || 0) + 1;
      });
      
      // Agent distribution
      const agentDistribution = {};
      orders.forEach(order => {
        if (order.agentDisplayName) {
          agentDistribution[order.agentDisplayName] = (agentDistribution[order.agentDisplayName] || 0) + 1;
        }
      });
      
      // Total revenue
      const totalRevenue = orders.reduce((sum, order) => sum + (order.price || 0), 0);
      
      // Order trend (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentOrders = orders.filter(o => o.createdAt >= sevenDaysAgo);
      
      const dailyTrend = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = date.toISOString().split('T')[0];
        dailyTrend[key] = 0;
      }
      
      recentOrders.forEach(order => {
        const key = order.createdAt.toISOString().split('T')[0];
        if (dailyTrend[key] !== undefined) {
          dailyTrend[key]++;
        }
      });
      
      return {
        totalOrders: orders.length,
        totalRevenue: totalRevenue,
        statusDistribution: statusDistribution,
        agentDistribution: agentDistribution,
        dailyTrend: dailyTrend,
        creditsRemaining: user.credits,
        subscriptionTier: user.subscriptionTier,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        totalConsignments: user.totalConsignments,
        trackingLimit: user.trackingLimit
      };
      
    } catch (error) {
      console.error('❌ Analytics error:', error.message);
      throw error;
    }
  }
}

// ============================================
// Notification Service
// ============================================

class NotificationService {
  constructor() {
    this.webSocketClients = new Map();
  }

  async sendStatusNotification(userId, orderId, oldStatus, newStatus) {
    try {
      // WebSocket notification
      const userClients = this.webSocketClients.get(userId) || [];
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'order_status_update',
            data: {
              orderId: orderId,
              oldStatus: oldStatus,
              newStatus: newStatus,
              timestamp: new Date().toISOString()
            }
          }));
        }
      });
      
      // Email notification (if email service configured)
      // await this.sendEmailNotification(userId, orderId, oldStatus, newStatus);
      
      // Mark tracking event as notified
      const trackingEvent = await TrackingEvent.findOne({
        orderId: orderId,
        notified: false
      }).sort({ timestamp: -1 });
      
      if (trackingEvent) {
        trackingEvent.notified = true;
        await trackingEvent.save();
      }
      
    } catch (error) {
      console.error('❌ Notification error:', error.message);
    }
  }

  registerWebSocketClient(userId, ws) {
    if (!this.webSocketClients.has(userId)) {
      this.webSocketClients.set(userId, []);
    }
    this.webSocketClients.get(userId).push(ws);
    
    // Remove client on close
    ws.on('close', () => {
      const clients = this.webSocketClients.get(userId) || [];
      const index = clients.indexOf(ws);
      if (index > -1) {
        clients.splice(index, 1);
      }
    });
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Initialize services
const orderService = new OrderManagementService();
const creditService = new CreditManagementService();
const paymentProcessor = new TrxPaymentProcessor();
const notificationService = new NotificationService();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '2.0.0'
  });
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user (simplified - in production use proper auth)
    const user = await User.findOne({ email });
    
    if (!user) {
      // Create user for demo
      const newUser = new User({
        email: email,
        name: req.body.name || 'User',
        credits: 5, // Free credits for testing
        subscriptionTier: 'free',
        trackingLimit: 5
      });
      
      await newUser.save();
      
      return res.json({
        success: true,
        user: {
          id: newUser._id,
          email: newUser.email,
          name: newUser.name,
          credits: newUser.credits,
          subscriptionTier: newUser.subscriptionTier
        },
        token: this.generateToken(newUser._id)
      });
    }
    
    // In production, verify password here
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        subscriptionTier: user.subscriptionTier
      },
      token: this.generateToken(user._id)
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, walletAddress } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { walletAddress }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const user = new User({
      email,
      name,
      walletAddress: walletAddress || null,
      credits: 0,
      subscriptionTier: 'free',
      trackingLimit: 5,
      createdAt: new Date()
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        subscriptionTier: user.subscriptionTier
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    // In production, implement proper JWT verification
    res.json({ valid: true });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ============================================
// CREDIT MANAGEMENT ENDPOINTS
// ============================================

app.post('/api/credits/purchase', async (req, res) => {
  try {
    const { userId, amount, tier, txHash } = req.body;
    
    const result = await paymentProcessor.processPayment(userId, amount, tier, txHash);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credits/verify-transaction', async (req, res) => {
  try {
    const { txHash, amount, walletAddress } = req.query;
    
    const result = await paymentProcessor.verifyTransaction(txHash, parseFloat(amount), walletAddress);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credits/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await creditService.checkUserCredits(userId);
    
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credits/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const transactions = await CreditTransaction.find({ userId })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    
    const total = await CreditTransaction.countDocuments({ userId });
    
    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ORDER MANAGEMENT ENDPOINTS
// ============================================

app.post('/api/orders/fetch', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Validate userId
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    // Check if user has active subscription
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.subscriptionTier === 'free' && user.credits <= 0) {
      return res.status(403).json({ 
        error: 'Please purchase credits to use this feature. Daily: $1 = 10 consignments' 
      });
    }
    
    // Check subscription expiry
    if (user.subscriptionExpiresAt && new Date() > user.subscriptionExpiresAt) {
      return res.status(403).json({ 
        error: 'Subscription expired. Please renew to continue using the service.' 
      });
    }
    
    const result = await orderService.fetchAndStoreOrders(userId);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const { userId, ...filters } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const result = await orderService.getOrders(userId, filters);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId, status, note } = req.body;
    
    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = new Date();
    
    // Add to status history
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: status,
      timestamp: new Date(),
      note: note || 'Manual status update'
    });
    
    await order.save();
    
    // Create tracking event
    const trackingEvent = new TrackingEvent({
      orderId: order._id,
      eventType: 'status_change',
      oldStatus: oldStatus,
      newStatus: status,
      note: note,
      timestamp: new Date(),
      notified: false
    });
    
    await trackingEvent.save();
    
    // Send notification
    await notificationService.sendStatusNotification(userId, orderId, oldStatus, status);
    
    res.json({
      success: true,
      order: order,
      message: `Order status updated from ${oldStatus} to ${status}`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:orderId/track', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.body;
    
    const result = await orderService.toggleTracking(orderId, userId);
    
    res.json({
      success: true,
      order: result,
      message: result.trackingEnabled ? 'Tracking enabled' : 'Tracking disabled'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:orderId/tracking-events', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.query;
    
    const events = await orderService.getTrackingEvents(orderId, userId);
    
    res.json({
      success: true,
      events: events
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

app.get('/api/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const analytics = await orderService.getAnalytics(userId);
    
    res.json({
      success: true,
      ...analytics
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUBSCRIPTION & PRICING ENDPOINTS
// ============================================

app.get('/api/pricing/plans', async (req, res) => {
  try {
    const plans = await PriceRule.find({ active: true }).sort({ price: 1 });
    
    res.json({
      success: true,
      plans: plans.map(p => ({
        tier: p.tier,
        name: p.name,
        price: p.price,
        creditsPerDollar: p.creditsPerDollar,
        bonusCredits: p.bonusCredits,
        maxTrackingOrders: p.maxTrackingOrders,
        totalCredits: p.creditsPerDollar + p.bonusCredits
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subscription/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      tier: user.subscriptionTier,
      expiresAt: user.subscriptionExpiresAt,
      creditsRemaining: user.credits,
      isActive: user.subscriptionExpiresAt ? new Date() < user.subscriptionExpiresAt : false
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WebSocket Server for Real-time Updates
// ============================================

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const userId = req.url.split('?userId=')[1];
  
  if (userId) {
    notificationService.registerWebSocketClient(userId, ws);
    console.log(`🔌 WebSocket connected for user: ${userId}`);
  }
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // Handle client messages
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 WebSocket disconnected: ${userId}`);
  });
});

// ============================================
// Scheduled Tasks
// ============================================

// Auto-fetch orders every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('🔄 Running scheduled order fetch...');
  try {
    // Get all users with active subscriptions
    const users = await User.find({
      isActive: true,
      credits: { $gt: 0 }
    });
    
    for (const user of users) {
      if (user.subscriptionExpiresAt && new Date() > user.subscriptionExpiresAt) {
        continue; // Skip expired subscriptions
      }
      
      try {
        await orderService.fetchAndStoreOrders(user._id);
        console.log(`✅ Auto-fetch completed for user: ${user.email}`);
      } catch (error) {
        console.error(`❌ Auto-fetch failed for ${user.email}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Scheduled fetch error:', error.message);
  }
});

// Check order status every 5 minutes for tracked orders
cron.schedule('*/5 * * * *', async () => {
  console.log('🔄 Checking tracked order statuses...');
  try {
    const trackedOrders = await Order.find({
      trackingEnabled: true,
      status: { $in: ['PENDING', 'PICKUP'] }
    });
    
    let updatedCount = 0;
    const pathaoClient = new PathaoApiClient();
    
    for (const order of trackedOrders) {
      try {
        const statusInfo = await pathaoClient.trackOrderStatus(
          order.consignmentId,
          order.orderId
        );
        
        if (statusInfo && statusInfo.status !== order.status) {
          const oldStatus = order.status;
          order.status = statusInfo.status;
          order.lastStatusCheck = new Date();
          order.updatedAt = new Date();
          
          // Add to status history
          if (!order.statusHistory) order.statusHistory = [];
          order.statusHistory.push({
            status: statusInfo.status,
            timestamp: new Date(),
            note: 'Auto-tracked status update'
          });
          
          // Create tracking event
          const trackingEvent = new TrackingEvent({
            orderId: order._id,
            eventType: 'status_change',
            oldStatus: oldStatus,
            newStatus: statusInfo.status,
            timestamp: new Date(),
            notified: false
          });
          
          await trackingEvent.save();
          await order.save();
          
          // Send notification
          await notificationService.sendStatusNotification(
            order.userId,
            order._id,
            oldStatus,
            statusInfo.status
          );
          
          updatedCount++;
          console.log(`✅ Order ${order.orderId}: ${oldStatus} → ${statusInfo.status}`);
        }
      } catch (error) {
        console.error(`❌ Tracking error for order ${order.orderId}:`, error.message);
      }
    }
    
    if (updatedCount > 0) {
      console.log(`📊 Updated ${updatedCount} orders with new status`);
    }
  } catch (error) {
    console.error('❌ Tracked order check error:', error.message);
  }
});

// ============================================
// Initialize Price Rules
// ============================================

async function initializePriceRules() {
  try {
    const count = await PriceRule.countDocuments();
    if (count === 0) {
      const rules = [
        {
          name: 'Daily Plan',
          tier: 'daily',
          creditsPerDollar: 10,
          bonusCredits: 0,
          maxTrackingOrders: 10,
          price: 1.00,
          active: true
        },
        {
          name: 'Weekly Plan',
          tier: 'weekly',
          creditsPerDollar: 25,
          bonusCredits: 5,
          maxTrackingOrders: 30,
          price: 1.00,
          active: true
        },
        {
          name: 'Monthly Plan',
          tier: 'monthly',
          creditsPerDollar: 33,
          bonusCredits: 10,
          maxTrackingOrders: 50,
          price: 1.00,
          active: true
        }
      ];
      
      await PriceRule.insertMany(rules);
      console.log('✅ Price rules initialized');
    }
  } catch (error) {
    console.error('❌ Price rule initialization error:', error.message);
  }
}

// ============================================
// Error Handling Middleware
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, closing gracefully...');
  server.close(() => {
    console.log('💤 Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

console.log('✅ Data Broker Backend Initialized');
console.log('📊 Pricing: Daily: $1=10 | Weekly: $1=25 | Monthly: $1=33 credits');
```

---

### **4. ENVIRONMENT VARIABLES (.env)**

```env
# ============================================
# Data Broker Backend Configuration
# ============================================

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/data_broker

# Server
PORT=3000
NODE_ENV=production

# Pathao API Credentials (HIDDEN)
PATHAO_CLIENT_ID=1
PATHAO_CLIENT_SECRET=your_client_secret_here

# Agent Credentials (NEVER exposed to frontend)
AGENT1_USERNAME=01894196973
AGENT1_PASSWORD=Shanto0.
AGENT2_USERNAME=01979372599
AGENT2_PASSWORD=Osd@2025
AGENT3_USERNAME=01887963639
AGENT3_PASSWORD=Noman21@
AGENT4_USERNAME=01829931879
AGENT4_PASSWORD=12345678
AGENT5_USERNAME=01842289818
AGENT5_PASSWORD=Osd@2025
AGENT6_USERNAME=01889238060
AGENT6_PASSWORD=12345678

# TRX Payment Configuration
TRX_CONTRACT_ADDRESS=TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WALLET_PRIVATE_KEY=your_wallet_private_key
TRONGRID_API=https://api.trongrid.io

# Email Notifications (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASSWORD=your_smtp_password

# Security
JWT_SECRET=your_jwt_secret_key_here
CORS_ORIGIN=https://your-github-pages-domain.github.io
```

---

### **5. FRONTEND DASHBOARD (React Component Blueprint)**

```jsx
// ============================================
// DataBrokerDashboard.jsx - React Component
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import WebSocket from 'ws';

// ============================================
// Main Dashboard Component
// ============================================

const DataBrokerDashboard = ({ userId, token }) => {
  // State Management
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    merchantName: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    currentPage: 1
  });
  const [credits, setCredits] = useState(0);
  const [subscription, setSubscription] = useState({
    tier: 'free',
    expiresAt: null
  });
  const [analytics, setAnalytics] = useState({});
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [trackingOrders, setTrackingOrders] = useState([]);
  
  const ws = useRef(null);
  
  // ============================================
  // WebSocket Connection
  // ============================================
  
  useEffect(() => {
    // Connect to WebSocket for real-time updates
    ws.current = new WebSocket(`wss://your-backend.com?userId=${userId}`);
    
    ws.current.onopen = () => {
      console.log('✅ WebSocket connected');
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'order_status_update') {
        // Update order in list
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === data.data.orderId 
              ? { ...order, status: data.data.newStatus }
              : order
          )
        );
        toast.info(`Order status updated: ${data.data.newStatus}`);
      }
    };
    
    ws.current.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId]);
  
  // ============================================
  // Load Initial Data
  // ============================================
  
  useEffect(() => {
    loadOrders();
    loadCredits();
    loadSubscription();
    loadAnalytics();
  }, [filters.page, filters.sortBy, filters.sortOrder]);
  
  // ============================================
  // API Functions
  // ============================================
  
  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/orders`, {
        params: {
          userId,
          ...filters
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setOrders(response.data.orders);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      toast.error('Failed to load orders: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const loadCredits = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/credits/balance/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setCredits(response.data.credits);
      }
    } catch (error) {
      console.error('Failed to load credits:', error);
    }
  };
  
  const loadSubscription = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/subscription/status/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setSubscription({
          tier: response.data.tier,
          expiresAt: response.data.expiresAt,
          isActive: response.data.isActive
        });
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };
  
  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/analytics/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };
  
  const fetchOrders = async () => {
    setIsFetching(true);
    try {
      const response = await axios.post(`${API_URL}/api/orders/fetch`, {
        userId
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        toast.success(`Fetched ${response.data.total} orders (${response.data.saved} new, ${response.data.updated} updated)`);
        loadOrders();
        loadCredits();
      }
    } catch (error) {
      toast.error('Failed to fetch orders: ' + error.response?.data?.error || error.message);
    } finally {
      setIsFetching(false);
    }
  };
  
  const updateOrderStatus = async (orderId, status, note = '') => {
    try {
      const response = await axios.put(`${API_URL}/api/orders/${orderId}/status`, {
        userId,
        status,
        note
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        toast.success(`Order status updated to ${status}`);
        loadOrders();
      }
    } catch (error) {
      toast.error('Failed to update order: ' + error.message);
    }
  };
  
  const toggleTracking = async (orderId) => {
    try {
      const response = await axios.post(`${API_URL}/api/orders/${orderId}/track`, {
        userId
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        toast.success(response.data.message);
        loadOrders();
      }
    } catch (error) {
      toast.error('Failed to toggle tracking: ' + error.response?.data?.error || error.message);
    }
  };
  
  const handleBulkAction = async (action, value) => {
    if (selectedOrders.length === 0) {
      toast.warning('Please select orders first');
      return;
    }
    
    try {
      const response = await axios.post(`${API_URL}/api/orders/bulk`, {
        userId,
        orderIds: selectedOrders,
        action,
        value
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        toast.success(`Updated ${response.data.updatedCount} orders`);
        setSelectedOrders([]);
        loadOrders();
      }
    } catch (error) {
      toast.error('Bulk action failed: ' + error.message);
    }
  };
  
  const exportOrders = async (format = 'csv') => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/export`, {
        params: {
          userId,
          format,
          ...filters
        },
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Export started');
    } catch (error) {
      toast.error('Export failed: ' + error.message);
    }
  };
  
  // ============================================
  // Render Functions
  // ============================================
  
  const renderHeader = () => (
    <div className="flex justify-between items-center p-4 bg-white shadow-md rounded-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          🚀 Data Broker Dashboard
        </h1>
        <div className="flex items-center space-x-4 mt-2">
          <span className="text-sm text-gray-600">
            Credits: <strong className="text-green-600">{credits.toFixed(2)}</strong>
          </span>
          <span className="text-sm text-gray-600">
            Plan: <span className="capitalize font-semibold">{subscription.tier}</span>
          </span>
          {subscription.expiresAt && (
            <span className="text-sm text-gray-600">
              Expires: {new Date(subscription.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={fetchOrders}
          disabled={isFetching}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isFetching ? '⏳ Fetching...' : '🔄 Fetch Orders'}
        </button>
        <button
          onClick={() => setShowPaymentModal(true)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          💰 Buy Credits
        </button>
        <button
          onClick={() => exportOrders('csv')}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
        >
          📥 Export CSV
        </button>
      </div>
    </div>
  );
  
  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="text-2xl font-bold text-blue-600">
          {analytics.totalOrders || 0}
        </div>
        <div className="text-sm text-gray-600">Total Orders</div>
      </div>
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <div className="text-2xl font-bold text-green-600">
          ${(analytics.totalRevenue || 0).toFixed(2)}
        </div>
        <div className="text-sm text-gray-600">Total Revenue</div>
      </div>
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <div className="text-2xl font-bold text-purple-600">
          {analytics.totalConsignments || 0}
        </div>
        <div className="text-sm text-gray-600">Consignments Processed</div>
      </div>
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
        <div className="text-2xl font-bold text-orange-600">
          {Object.keys(analytics.agentDistribution || {}).length}
        </div>
        <div className="text-sm text-gray-600">Active Agents</div>
      </div>
    </div>
  );
  
  const renderFilters = () => (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="🔍 Search orders..."
          value={filters.search}
          onChange={(e) => setFilters({...filters, search: e.target.value})}
          onKeyPress={(e) => e.key === 'Enter' && loadOrders()}
          className="border rounded-lg px-3 py-2"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PICKUP">Pickup</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="FAILED">Failed</option>
        </select>
        <input
          type="text"
          placeholder="Merchant name..."
          value={filters.merchantName}
          onChange={(e) => setFilters({...filters, merchantName: e.target.value})}
          className="border rounded-lg px-3 py-2"
        />
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
          className="border rounded-lg px-3 py-2"
        >
          <option value="createdAt">Date</option>
          <option value="merchantName">Merchant</option>
          <option value="price">Price</option>
          <option value="status">Status</option>
        </select>
      </div>
      <div className="flex justify-end mt-2">
        <button
          onClick={loadOrders}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
  
  const renderOrderTable = () => (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={selectedOrders.length === orders.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedOrders(orders.map(o => o._id));
                  } else {
                    setSelectedOrders([]);
                  }
                }}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Order ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Merchant
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Recipient
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Agent
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tracking
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan="10" className="px-6 py-4 text-center">
                ⏳ Loading orders...
              </td>
            </tr>
          ) : orders.length === 0 ? (
            <tr>
              <td colSpan="10" className="px-6 py-4 text-center text-gray-500">
                No orders found. Click "Fetch Orders" to load data.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders([...selectedOrders, order._id]);
                      } else {
                        setSelectedOrders(selectedOrders.filter(id => id !== order._id));
                      }
                    }}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.orderId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.merchantName}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                  {order.productDescription || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${(order.price || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {order.recipientName}
                  <div className="text-xs text-gray-500">{order.recipientPhone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.agentDisplayName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                    order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'PICKUP' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleTracking(order._id)}
                    className={`px-2 py-1 text-xs rounded ${
                      order.trackingEnabled
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                    }`}
                  >
                    {order.trackingEnabled ? '🔍 Tracking' : 'Track'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => updateOrderStatus(order._id, 'PICKUP')}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Pickup
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order._id, 'DELIVERED')}
                      className="text-green-600 hover:text-green-800 text-xs"
                    >
                      Deliver
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Cancel this order?')) {
                          updateOrderStatus(order._id, 'CANCELLED');
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Cancel
                    </button>
                    <a
                      href={order.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800 text-xs"
                    >
                      📦 Track
                    </a>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Showing {((pagination.currentPage - 1) * filters.limit) + 1} to{' '}
            {Math.min(pagination.currentPage * filters.limit, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              disabled={filters.page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 border rounded bg-gray-100">
              {filters.page} / {pagination.pages}
            </span>
            <button
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              disabled={filters.page === pagination.pages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
  
  const renderBulkActions = () => (
    <div className="bg-white p-4 rounded-lg shadow-md mt-4">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium">
          {selectedOrders.length} selected
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => handleBulkAction('status', 'PICKUP')}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Mark Pickup
          </button>
          <button
            onClick={() => handleBulkAction('status', 'DELIVERED')}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            Mark Delivered
          </button>
          <button
            onClick={() => {
              if (window.confirm('Cancel selected orders?')) {
                handleBulkAction('status', 'CANCELLED');
              }
            }}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Cancel Selected
          </button>
          <button
            onClick={() => {
              if (window.confirm('Delete selected orders?')) {
                handleBulkAction('delete', 'delete');
              }
            }}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
          >
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
  
  const renderPaymentModal = () => (
    showPaymentModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">💰 Purchase Credits</h2>
          <p className="text-gray-600 mb-4">
            Current balance: <strong>{credits.toFixed(2)} credits</strong>
          </p>
          
          <div className="space-y-3 mb-6">
            {[
              { tier: 'daily', label: 'Daily Plan', credits: '10', price: '$1.00' },
              { tier: 'weekly', label: 'Weekly Plan', credits: '25', price: '$1.00' },
              { tier: 'monthly', label: 'Monthly Plan', credits: '33', price: '$1.00' }
            ].map((plan) => (
              <button
                key={plan.tier}
                onClick={() => {
                  // Trigger TRX payment
                  toast.info(`Initiating ${plan.tier} plan purchase...`);
                  // Implement TRX payment flow here
                }}
                className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold">{plan.label}</div>
                  <div className="text-sm text-gray-600">
                    {plan.credits} credits for {plan.price}
                  </div>
                </div>
                <span className="text-blue-500">→</span>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setShowPaymentModal(false)}
            className="w-full px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    )
  );
  
  // ============================================
  // Main Render
  // ============================================
  
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {renderHeader()}
      {renderStats()}
      
      <div className="mt-4">
        {renderFilters()}
      </div>
      
      <div className="mt-4">
        {renderOrderTable()}
      </div>
      
      {selectedOrders.length > 0 && renderBulkActions()}
      {renderPaymentModal()}
    </div>
  );
};

export default DataBrokerDashboard;
```

---

### **6. IMPLEMENTATION CHECKLIST**

```markdown
## ✅ Implementation Checklist

### Backend Setup
- [ ] Deploy Node.js backend to Render
- [ ] Configure MongoDB Atlas database
- [ ] Set environment variables
- [ ] Test database connection
- [ ] Initialize price rules

### Pathao Integration
- [ ] Configure agent credentials (hidden)
- [ ] Test login for all agents
- [ ] Verify order fetching
- [ ] Implement status tracking
- [ ] Test rate limiting

### TRX Payment Integration
- [ ] Set up TRX wallet
- [ ] Configure contract address
- [ ] Implement transaction verification
- [ ] Test payment flow
- [ ] Add webhook for confirmations

### Frontend Implementation
- [ ] Create React dashboard component
- [ ] Implement WebSocket for real-time updates
- [ ] Add filtering and sorting
- [ ] Add bulk actions
- [ ] Implement export functionality
- [ ] Add subscription management

### Testing
- [ ] Test order fetching with credits
- [ ] Test subscription expiry
- [ ] Test tracking notifications
- [ ] Test payment flow
- [ ] Test WebSocket connections
- [ ] Load testing

### Deployment
- [ ] Deploy backend to Render
- [ ] Deploy frontend to GitHub Pages
- [ ] Configure CORS
- [ ] Set up SSL certificate
- [ ] Enable monitoring

### Documentation
- [ ] API documentation
- [ ] User guide
- [ ] Developer documentation
- [ ] Deployment guide
```

---

## Next upgrade: The order status will be Assigned, Delivered,Hold,Returned,Delivered percel will be colored as red.