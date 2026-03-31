const express = require('express');
const methodOverride = require('method-override');
const businessesRouter = require('./routes/businesses');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const remindersRouter = require('./routes/reminders');
const dashboardRouter = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 12000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Routes
app.use('/', dashboardRouter);
app.use('/businesses', businessesRouter);
app.use('/customers', customersRouter);
app.use('/orders', ordersRouter);
app.use('/reminders', remindersRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Pet CRM Lite API running' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

module.exports = app;