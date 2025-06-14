const axios = require('axios');
require('dotenv').config()

const orderServiceAxios = axios.create({
    baseURL: `${process.env.URL_API_GATEWAY}/order` || 'http://localhost:3000/order',
    validateStatus: function (status) {
        // Luôn trả về true để không throw lỗi với bất kỳ status code nào
        return true;
    }
});

module.exports = orderServiceAxios;
