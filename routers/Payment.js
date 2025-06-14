const express = require('express')
const Router = express.Router()

const Controller = require('../controllers/Payment')

const authenticateToken = require('../middlewares/auth');

// Payment Methods Routes
Router.get('/methods', Controller.getPaymentMethods);
Router.post('/methods', Controller.createPaymentMethod);
Router.put('/methods/:id', Controller.updatePaymentMethod);
Router.delete('/methods/:id', Controller.deletePaymentMethod);

// Payment History Routes
Router.get('/history', Controller.getPaymentHistory);
Router.get('/user/:user_id/history', Controller.getUserPaymentHistory);
Router.get('/:id', Controller.getPaymentDetails);

// Payment Creation Routes
Router.post('/', Controller.createPayment);
Router.post('/cod', Controller.createCODPayment);
Router.post('/vnpay/create_payment_url', Controller.VNPay); // tạo thanh toán VNPay cho 1 đơn hàng
Router.post('/vnpay/create_payment_url/multiple', Controller.VNPayMultiple); // tạo thanh toán VNPay chung cho nhiều đơn hàng cùng lúc

// Payment Status Update Routes
Router.patch('/:id/status', Controller.updatePaymentStatusByID); // cập nhật trạng thái thanh toán theo ID
Router.patch('/order/:order_id/status', Controller.updatePaymentStatusByOrderID); // cập nhật trạng thái thanh toán theo ID đơn hàng
// Router.patch('/cod/:id/status', Controller.updateCODPaymentStatus); // không cần thiết, dùng updatePaymentStatus là đủ

// VNPay Return URL
Router.get("/vnpay/vnpay_return", Controller.VNPayReturn);

module.exports = Router