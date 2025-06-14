const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Payment_method = sequelize.define('Payment_method', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    method_name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Tên phương thức thanh toán'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả về phương thức thanh toán'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Trạng thái hoạt động của phương thức thanh toán'
    }
}, {
    tableName: 'payment_methods',
    timestamps: true,
    indexes: [
        {
            fields: ['method_name']
        },
        {
            fields: ['is_active']
        }
    ]
});

module.exports = Payment_method; 