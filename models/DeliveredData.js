import mongoose from 'mongoose';

const deliveredDataSchema = new mongoose.Schema({
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LocationTrackerServiceRequest',
        required: true
    },
    dataType: {
        type: String,
        enum: ['location', 'nid', 'callList'], // Assuming these are the types of data
        required: true
    },
    dataContent: {
        type: mongoose.Schema.Types.Mixed, // Can be string, object, array, etc.
        required: true
    },
    deliveredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin', // Assuming Admin model is used for moderators too
        required: true
    },
    deliveredAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const DeliveredData = mongoose.model('DeliveredData', deliveredDataSchema);

export default DeliveredData;
