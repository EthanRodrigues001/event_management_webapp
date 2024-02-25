          const mongoose = require('mongoose');


          const eventSchema = new mongoose.Schema({
            eventName: {
              type: String,
              required: true
            },
            eventDescription: {
              type: String,
            },
            createdBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User', 
              required: true
            },
            approved: {
              type: Boolean,
              default: false
            },
            pending: {
              type: Boolean,
              default: true
            },
            createdAt: {
              type: Date,
              default: Date.now
            }
          });

          module.exports = mongoose.model('Event', eventSchema);
