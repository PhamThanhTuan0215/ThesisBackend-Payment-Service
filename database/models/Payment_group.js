const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Payment_group = sequelize.define('Payment_group', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    }
}, {
    tableName: 'payment_groups',
    timestamps: true
});

module.exports = Payment_group; 