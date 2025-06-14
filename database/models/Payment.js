const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Payment_method = require('./Payment_method'); // import Payment_method để tạo quan hệ với Payment_method
const Payment_group = require('./Payment_group'); // import Payment_group để tạo quan hệ với Payment_group

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    order_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'ID đơn hàng từ service khác'
    },
    seller_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'ID người bán từ service khác'
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'ID người dùng từ service khác'
    },
    payment_method_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'payment_methods',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    payment_group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'payment_groups',
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Số tiền thanh toán'
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Trạng thái thanh toán (pending, completed, failed, cancelled, refunded)'
    }
}, {
    tableName: 'payments',
    timestamps: true,
    indexes: [
        {
            fields: ['order_id']
        },
        {
            fields: ['user_id']
        },
        {
            fields: ['payment_method_id']
        },
        {
            fields: ['status']
        }
    ]
});

Payment.belongsTo(Payment_method, { foreignKey: 'payment_method_id' });
Payment.belongsTo(Payment_group, { foreignKey: 'payment_group_id' });

module.exports = Payment;