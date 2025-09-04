const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    discountPercentage: { type: Number, required: true },
    isUsed: { type: Boolean, default: false },
    validUntil: { type: Date, required: false },
    report: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'reportModel'
    },
    reportModel: {
        type: String,
        required: true,
        enum: ['MerchantIssue', 'PenaltyReport', 'PremiumService', 'User']
    }
}, { timestamps: true });

const Voucher = mongoose.model('Voucher', voucherSchema);

module.exports = Voucher;
