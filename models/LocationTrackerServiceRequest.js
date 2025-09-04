import mongoose from 'mongoose';

const locationTrackerServiceRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sourceType: {
        type: String,
        enum: ['imei', 'phoneNumber'],
        required: true
    },
    dataNeeded: {
        type: [String], // Array of strings like 'location', 'NID', 'callList3Months'
        required: true
    },
    serviceTypes: {
        type: [String], // Array of full service keys like 'imeiToNumber', 'numberToLocation'
        required: true
    },
    imei: {
        type: String,
        required: function() { return this.sourceType === 'imei'; }
    },
    phoneNumber: {
        type: String,
        required: function() { return this.sourceType === 'phoneNumber'; }
    },
    lastUsedPhoneNumber: {
        type: String,
        required: false // Optional
    },
    additionalNote: {
        type: String
    },
    serviceCharge: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true
    },
    trxId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
        default: 'Pending'
    }
}, { timestamps: true });

const LocationTrackerServiceRequest = mongoose.model('LocationTrackerServiceRequest', locationTrackerServiceRequestSchema);

export default LocationTrackerServiceRequest;
