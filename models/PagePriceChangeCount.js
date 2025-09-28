const mongoose = require('mongoose');

const pagePriceChangeCountSchema = new mongoose.Schema({
  pageName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  count: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true });

const PagePriceChangeCount = mongoose.model('PagePriceChangeCount', pagePriceChangeCountSchema);

module.exports = PagePriceChangeCount;
