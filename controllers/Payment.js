const crypto = require("crypto");
const querystring = require("qs");
const moment = require("moment");
const { Op } = require('sequelize');
const Payment = require('../database/models/Payment');
const Payment_method = require('../database/models/Payment_method');
const Payment_group = require('../database/models/Payment_group');
require("dotenv").config();

const orderServiceAxios = require('../services/orderService')

// Lấy danh sách phương thức thanh toán
module.exports.getPaymentMethods = async (req, res) => {
    try {
        const paymentMethods = await Payment_method.findAll({
            where: { is_active: true }
        });
        res.json({
            code: 0,
            success: true,
            data: paymentMethods
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Tạo phương thức thanh toán mới (Admin only)
module.exports.createPaymentMethod = async (req, res) => {
    try {
        const { method_name, description } = req.body;
        const paymentMethod = await Payment_method.create({
            method_name,
            description,
            is_active: true
        });
        res.status(201).json({
            code: 0,
            success: true,
            data: paymentMethod
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Lấy thông tin thanh toán theo ID
module.exports.getPaymentById = async (req, res) => {
    try {
        const payment = await Payment.findByPk(req.params.id, {
            include: [{
                model: Payment_method,
                attributes: ['method_name', 'description']
            }]
        });
        if (!payment) {
            return res.status(404).json({
                code: 3,
                success: false,
                message: 'Payment not found'
            });
        }
        res.json({
            code: 0,
            success: true,
            data: payment
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Tạo thanh toán mới
module.exports.createPayment = async (req, res) => {
    try {
        const { user_id, payment_method_id, orders } = req.body;

        const paymentPromises = orders.map(async (order) => {
            return await Payment.create({
                order_id: order.id,
                user_id: user_id,
                seller_id: order.seller_id,
                payment_method_id,
                amount: order.final_total,
                status: 'pending'
            });
        });

        const payments = await Promise.all(paymentPromises);

        res.status(201).json({
            code: 0,
            success: true,
            data: payments
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Cập nhật trạng thái thanh toán theo ID
module.exports.updatePaymentStatusByID = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const payment = await Payment.findByPk(id);
        if (!payment) {
            return res.status(404).json({
                code: 3,
                success: false,
                message: 'Payment not found'
            });
        }

        await payment.update({ status });

        // gọi api order service để cập nhật trạng thái thanh toán đơn hàng
        orderServiceAxios.put(`/orders/${payment.order_id}`, {
            payment_status: status
        });

        res.json({
            code: 0,
            success: true,
            data: payment
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Cập nhật trạng thái thanh toán theo ID đơn hàng
module.exports.updatePaymentStatusByOrderID = async (req, res) => {
    try {
        const { order_id } = req.params;
        const { status } = req.body;

        const payment = await Payment.findOne({
            where: {
                order_id: order_id
            }
        });

        if (!payment) {
            return res.status(404).json({
                code: 3,
                success: false,
                message: 'Payment not found'
            });
        }

        await payment.update({ status });

        // gọi api order service để cập nhật trạng thái thanh toán đơn hàng
        orderServiceAxios.put(`/orders/${payment.order_id}`, {
            payment_status: status
        });

        res.json({
            code: 0,
            success: true,
            data: payment
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Tích hợp VNPay
module.exports.VNPay = async (req, res) => {
    try {
        const { order_id, user_id, seller_id, amount, bankCode, language } = req.body;

        const vnpayMethod = await Payment_method.findOne({
            where: { method_name: 'VNPAY' }
        });

        if (!vnpayMethod) {
            return res.status(400).json({
                code: 4,
                success: false,
                message: 'VNPAY payment method not found'
            });
        }

        let payment = await Payment.findOne({
            where: {
                order_id,
                user_id: user_id
            }
        });

        if (payment) {
            // Nếu payment đã tồn tại và chưa thành công, tạo payment mới
            if (payment.status !== 'completed') {
                // xóa payment cũ
                await Payment.destroy({
                    where: {
                        id: payment.id
                    }
                });

                payment = await Payment.create({
                    order_id,
                    user_id,
                    seller_id,
                    payment_method_id: vnpayMethod.id,
                    amount,
                    status: 'pending'
                });
            } else {
                return res.status(400).json({
                    code: 4,
                    success: false,
                    message: 'Payment for this order has already been completed'
                });
            }
        } else {
            payment = await Payment.create({
                order_id,
                user_id,
                seller_id,
                payment_method_id: vnpayMethod.id,
                amount,
                status: 'pending'
            });
        }

        process.env.TZ = "Asia/Ho_Chi_Minh";
        let date = new Date();
        let createDate = moment(date).format("YYYYMMDDHHmmss");

        let ipAddr = req.headers["x-forwarded-for"] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;

        let tmnCode = "EXNLMNRI";
        let secretKey = "VSYN4JDWTCS3N7MLKSOMI7MCUHBSSARK";
        let vnpUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        let returnUrl = process.env.URL_API_GATEWAY + "/payment" + "/payments/vnpay/vnpay_return";

        let locale = language || "vn";
        let currCode = "VND";
        let vnp_Params = {};
        vnp_Params["vnp_Version"] = "2.1.0";
        vnp_Params["vnp_Command"] = "pay";
        vnp_Params["vnp_TmnCode"] = tmnCode;
        vnp_Params["vnp_Locale"] = locale;
        vnp_Params["vnp_CurrCode"] = currCode;
        vnp_Params["vnp_TxnRef"] = payment.id.toString();
        vnp_Params["vnp_OrderInfo"] = `Thanh toan don hang ${order_id}`;
        vnp_Params["vnp_OrderType"] = "other";
        vnp_Params["vnp_Amount"] = amount * 100;
        vnp_Params["vnp_ReturnUrl"] = returnUrl;
        vnp_Params["vnp_IpAddr"] = ipAddr;
        vnp_Params["vnp_CreateDate"] = createDate;

        if (bankCode) {
            vnp_Params["vnp_BankCode"] = bankCode;
        }

        vnp_Params = sortObject(vnp_Params);
        let signData = querystring.stringify(vnp_Params, { encode: false });
        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
        vnp_Params["vnp_SecureHash"] = signed;

        vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });

        console.log('vnpUrl:', vnpUrl);

        res.json({
            code: 0,
            success: true,
            data: {
                url: vnpUrl,
                payment
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

module.exports.VNPayMultiple = async (req, res) => {
    try {
        const { orders, user_id, bankCode, language } = req.body;

        console.log('orders:', orders);

        const vnpayMethod = await Payment_method.findOne({
            where: { method_name: 'VNPAY' }
        });

        if (!vnpayMethod) {
            return res.status(400).json({
                code: 4,
                success: false,
                message: 'VNPAY payment method not found'
            });
        }

        // Tạo một payment group để quản lý nhiều payment
        const paymentGroup = await Payment_group.create({
            user_id,
            status: 'pending',
            total_amount: orders.reduce((sum, order) => sum + Number(order.final_total), 0)
        });

        // Tạo các payment riêng lẻ và liên kết với payment group
        const paymentPromises = orders.map(async (order) => {
            return await Payment.create({
                order_id: order.id,
                user_id: user_id,
                seller_id: order.seller_id,
                payment_method_id: vnpayMethod.id,
                amount: order.final_total,
                status: 'pending',
                payment_group_id: paymentGroup.id
            });
        });

        const payments = await Promise.all(paymentPromises);

        process.env.TZ = "Asia/Ho_Chi_Minh";
        let date = new Date();
        let createDate = moment(date).format("YYYYMMDDHHmmss");

        let ipAddr = req.headers["x-forwarded-for"] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;

        let tmnCode = "EXNLMNRI";
        let secretKey = "VSYN4JDWTCS3N7MLKSOMI7MCUHBSSARK";
        let vnpUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        let returnUrl = process.env.URL_API_GATEWAY + "/payment" + "/payments/vnpay/vnpay_return";

        let locale = language || "vn";
        let currCode = "VND";
        let vnp_Params = {};
        vnp_Params["vnp_Version"] = "2.1.0";
        vnp_Params["vnp_Command"] = "pay";
        vnp_Params["vnp_TmnCode"] = tmnCode;
        vnp_Params["vnp_Locale"] = locale;
        vnp_Params["vnp_CurrCode"] = currCode;
        vnp_Params["vnp_TxnRef"] = `G${paymentGroup.id}`; // Thêm tiền tố G để phân biệt là payment group
        vnp_Params["vnp_OrderInfo"] = `Thanh toan nhom don hang ${paymentGroup.id}`;
        vnp_Params["vnp_OrderType"] = "other";
        vnp_Params["vnp_Amount"] = paymentGroup.total_amount * 100;
        vnp_Params["vnp_ReturnUrl"] = returnUrl;
        vnp_Params["vnp_IpAddr"] = ipAddr;
        vnp_Params["vnp_CreateDate"] = createDate;

        if (bankCode) {
            vnp_Params["vnp_BankCode"] = bankCode;
        }

        vnp_Params = sortObject(vnp_Params);
        let signData = querystring.stringify(vnp_Params, { encode: false });
        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
        vnp_Params["vnp_SecureHash"] = signed;

        vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });

        res.json({
            code: 0,
            success: true,
            data: {
                url: vnpUrl,
                payment_group_id: paymentGroup.id,
                payments: payments
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
}

module.exports.VNPayReturn = async (req, res) => {
    try {
        let vnp_Params = req.query;
        let secureHash = vnp_Params["vnp_SecureHash"];

        delete vnp_Params["vnp_SecureHash"];
        delete vnp_Params["vnp_SecureHashType"];

        vnp_Params = sortObject(vnp_Params);

        let tmnCode = "EXNLMNRI";
        let secretKey = "VSYN4JDWTCS3N7MLKSOMI7MCUHBSSARK";

        let signData = querystring.stringify(vnp_Params, { encode: false });
        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

        if (secureHash === signed) {
            const txnRef = vnp_Params["vnp_TxnRef"];
            const responseCode = vnp_Params["vnp_ResponseCode"];

            // Kiểm tra xem có phải là payment group không (thanh toán chung cho nhiều đơn cùng lúc)
            if (txnRef.startsWith('G')) {
                const groupId = parseInt(txnRef.substring(1));
                const paymentGroup = await Payment_group.findByPk(groupId);

                if (!paymentGroup) {
                    return res.status(404).json({
                        code: 3,
                        success: false,
                        message: "Payment group not found"
                    });
                }

                // Lấy tất cả các payment trong group
                const payments = await Payment.findAll({
                    where: { payment_group_id: groupId }
                });

                if (responseCode === "00") {
                    // Cập nhật trạng thái của payment group
                    await paymentGroup.update({ status: 'completed' });

                    // Cập nhật trạng thái của tất cả các payment trong group
                    await Promise.all(payments.map(async (payment) => {
                        await payment.update({ status: 'completed' });
                        // Cập nhật trạng thái thanh toán cho từng đơn hàng
                        await orderServiceAxios.put(`/orders/${payment.order_id}`, {
                            payment_status: 'completed'
                        });
                    }));

                    // return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/success/group/${groupId}`);
                    return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/success`);
                } else {
                    // Cập nhật trạng thái thất bại cho group và tất cả payment
                    await paymentGroup.update({ status: 'failed' });
                    await Promise.all(payments.map(async (payment) => {
                        await payment.update({ status: 'failed' });
                        await orderServiceAxios.put(`/orders/${payment.order_id}`, {
                            payment_status: 'failed'
                        });
                    }));

                    // return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/failed/group/${groupId}`);
                    return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/failed`);
                }
            } else {
                // Xử lý payment đơn lẻ như cũ
                const payment = await Payment.findByPk(txnRef);
                if (!payment) {
                    return res.status(404).json({
                        code: 3,
                        success: false,
                        message: "Payment not found"
                    });
                }

                if (responseCode === "00") {
                    await payment.update({ status: 'completed' });
                    await orderServiceAxios.put(`/orders/${payment.order_id}`, {
                        payment_status: 'completed'
                    });
                    // return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/success/${payment.id}`);
                    return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/success`);
                } else {
                    await payment.update({ status: 'failed' });
                    await orderServiceAxios.put(`/orders/${payment.order_id}`, {
                        payment_status: 'failed'
                    });
                    // return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/failed/${payment.id}`);
                    return res.redirect(process.env.URL_CUSTOMER_CLIENT + `/payment/failed`);
                }
            }
        } else {
            return res.status(400).json({
                code: 6,
                success: false,
                message: "Invalid signature"
            });
        }
    } catch (error) {
        return res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

// Lấy danh sách lịch sử giao dịch với bộ lọc và phân trang
module.exports.getPaymentHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            startDate,
            endDate,
            status,
            payment_method_id,
            user_id,
            seller_id
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        if (startDate && endDate) {
            where.createdAt = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        if (status) {
            where.status = status;
        }

        if (payment_method_id) {
            where.payment_method_id = payment_method_id;
        }

        if (user_id) {
            where.user_id = user_id;
        }

        if (seller_id) {
            where.seller_id = seller_id;
        }

        const { count, rows } = await Payment.findAndCountAll({
            where,
            include: [{
                model: Payment_method,
                attributes: ['method_name', 'description']
            }],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            code: 0,
            success: true,
            data: {
                payments: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Lấy lịch sử giao dịch của một người dùng cụ thể
module.exports.getUserPaymentHistory = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows } = await Payment.findAndCountAll({
            where: { user_id },
            include: [{
                model: Payment_method,
                attributes: ['method_name', 'description']
            }],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            code: 0,
            success: true,
            data: {
                payments: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Lấy chi tiết giao dịch
module.exports.getPaymentDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await Payment.findByPk(id, {
            include: [{
                model: Payment_method,
                attributes: ['method_name', 'description']
            }]
        });

        if (!payment) {
            return res.status(404).json({
                code: 3,
                success: false,
                message: 'Payment not found'
            });
        }

        const paymentDetails = {
            id: payment.id,
            order_id: payment.order_id,
            user_id: payment.user_id,
            seller_id: payment.seller_id,
            amount: payment.amount,
            status: payment.status,
            payment_method: payment.Payment_method.method_name,
            created_at: payment.createdAt,
            updated_at: payment.updatedAt,
            description: payment.Payment_method.description
        };

        res.json({
            code: 0,
            success: true,
            data: paymentDetails
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Tạo yêu cầu thanh toán COD
module.exports.createCODPayment = async (req, res) => {
    try {
        const {
            user_id,
            orders
        } = req.body;

        const codMethod = await Payment_method.findOne({
            where: { method_name: 'COD' }
        });

        if (!codMethod) {
            return res.status(400).json({
                code: 4,
                success: false,
                message: 'COD payment method not found'
            });
        }

        const paymentPromises = orders.map(async (order) => {
            return await Payment.create({
                order_id: order.id,
                user_id: user_id,
                seller_id: order.seller_id,
                payment_method_id: codMethod.id,
                amount: order.final_total,
                status: 'pending'
            });
        });

        const payments = await Promise.all(paymentPromises);

        res.status(201).json({
            code: 0,
            success: true,
            data: payments
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Cập nhật trạng thái giao dịch COD
// module.exports.updateCODPaymentStatus = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;

//         const payment = await Payment.findByPk(id, {
//             include: [{
//                 model: Payment_method,
//                 where: { method_name: 'COD' }
//             }]
//         });

//         if (!payment) {
//             return res.status(404).json({
//                 code: 3,
//                 success: false,
//                 message: 'COD payment not found'
//             });
//         }

//         const validStatuses = ['pending', 'completed', 'failed', 'cancelled', 'refunded'];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({
//                 code: 5,
//                 success: false,
//                 message: 'Invalid status'
//             });
//         }

//         await payment.update({
//             status,
//             updatedAt: new Date()
//         });

//         orderServiceAxios.put(`/orders/${payment.order_id}`, {
//             payment_status: status
//         });

//         res.json({
//             code: 0,
//             success: true,
//             data: payment
//         });
//     } catch (error) {
//         res.status(500).json({
//             code: 2,
//             success: false,
//             message: error.message
//         });
//     }
// };

// Cập nhật phương thức thanh toán (Admin only)
module.exports.updatePaymentMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const { method_name, description, is_active } = req.body;

        const paymentMethod = await Payment_method.findByPk(id);
        if (!paymentMethod) {
            return res.status(404).json({
                code: 7,
                success: false,
                message: 'Payment method not found'
            });
        }

        await paymentMethod.update({
            method_name,
            description,
            is_active
        });

        res.json({
            code: 0,
            success: true,
            data: paymentMethod
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};

// Xóa phương thức thanh toán (Admin only)
module.exports.deletePaymentMethod = async (req, res) => {
    try {
        const { id } = req.params;

        const paymentMethod = await Payment_method.findByPk(id);
        if (!paymentMethod) {
            return res.status(404).json({
                code: 7,
                success: false,
                message: 'Payment method not found'
            });
        }

        // Kiểm tra xem có payment nào đang sử dụng phương thức này không
        const paymentCount = await Payment.count({
            where: { payment_method_id: id }
        });

        if (paymentCount > 0) {
            return res.status(400).json({
                code: 8,
                success: false,
                message: 'Cannot delete payment method that is being used by existing payments'
            });
        }

        await paymentMethod.destroy();

        res.json({
            code: 0,
            success: true,
            message: 'Payment method deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            code: 2,
            success: false,
            message: error.message
        });
    }
};