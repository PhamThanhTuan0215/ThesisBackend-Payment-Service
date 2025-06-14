const express = require('express');
const app = express();
const sequelize = require('./database/sequelize')
const bodyParser = require('body-parser');

require('dotenv').config()
const { PORT } = process.env

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    return res.status(200).json({ code: 0, message: 'Run payment service successfully' })
})

app.use('/payments', require('./routers/Payment'))

sequelize.authenticate()
    .then(() => {
        console.log("Connect database server successfully")

        sequelize.sync() // Tạo bảng mới nếu bảng chưa tồn tại, nếu đã tồn tại thì giữ nguyên bảng cũ (nếu sửa đổi bảng cũ thành giống với model hiện tại thì có thể xảy ra lỗi mất hết toàn bộ dữ liệu trong bảng cũ, vì nó sẽ drop bảng cũ và tạo bảng mới)
            .then(() => {

                console.log('Database synchronized');

                app.listen(PORT || 3003, () => {
                    console.log("http://localhost:" + (PORT || 3003));
                });
            })
            .catch(err => {
                console.log("Error syncing database:", err.message);
                process.exit(1);
            });
    })
    .catch(err => {
        console.log("Can not connect database server: " + err.message)
        process.exit(1);
    });

module.exports = app;