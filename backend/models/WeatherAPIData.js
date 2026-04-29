const mongoose = require('mongoose');

const forecastDaySchema = new mongoose.Schema({
  date: String,
  temp_min: Number,
  temp_max: Number,
  humidity: Number,
  rain_probability: Number,
  condition: String,
  icon: String
}, { _id: false });

const weatherAPIDataSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    default: 'Indore'
  },
  temperature: Number,
  humidity: Number,
  rain_probability: {
    type: Number,
    default: 0
  },
  wind_speed: {
    type: Number,
    default: 0
  },
  weather_condition: {
    type: String,
    default: 'Clear'
  },
  weather_icon: {
    type: String,
    default: '☀️'
  },
  forecast_data: [forecastDaySchema],
  fetched_at: {
    type: Date,
    default: Date.now
  }
});

weatherAPIDataSchema.index({ city: 1 });
weatherAPIDataSchema.index({ fetched_at: -1 });

module.exports = mongoose.model('WeatherAPIData', weatherAPIDataSchema);
