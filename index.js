const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const PORT = process.env.port || 7000;

let PAYPAL_CLIENT_ID = 'AfpyyGSj9_kRIyKGwQDArRfkTrNEV8chIqeS7Oy0k8bqB4RlDF3HR27GkuQHH0Ng_-U1dUol4xagEnK4';
let PAYPAL_CLIENT_SECRET = 'EIt6fqVXdQYXyrgFjbNu4Vbpyzv6tCs9LXQMQMJ-PftaTjfkmdCtXJWLARdsAgz1L3IIYtIRCRAxrB6a';
const base = "https://api-m.sandbox.paypal.com";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const generateAccessToken = async () => {
    try {
        if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
            throw new Error("MISSING_API_CREDENTIALS");
        }
        const auth = Buffer.from(
            PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
        ).toString("base64");
        const response = await fetch(`${base}/v1/oauth2/token`, {
            method: "POST",
            body: "grant_type=client_credentials",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
        });

        const data = await response.json();
        console.log('token>>>>>>>>>>>>>', data.access_token);
        return data.access_token;
    } catch (error) {
        console.error("Failed to generate Access Token:", error);
    }
};

app.post("/api/orders", async (req, res) => {
    try {
        let { amount } = req.body
        let converted_amount = amount
        let baseReturnUrl = 'http://192.168.29.100:7000/success'
        let baseCancleUrl = 'http://192.168.29.100:7000/cancel'
        let returnUrlWithAmount = `${baseReturnUrl}?amount=${encodeURIComponent(converted_amount)}`
        console.log('returnUrlWithAmount', returnUrlWithAmount);
        const token = await generateAccessToken();
        const create_payment_json = {
            intent: "sale",
            payer: {
                payment_method: "paypal"
            },
            redirect_urls: {
                return_url: returnUrlWithAmount,
                cancel_url: baseCancleUrl
            },
            transactions: [{
                item_list: {
                    items: [{
                        name: "item",
                        sku: "item",
                        price: amount,
                        currency: "USD",
                        quantity: 1
                    }]
                },
                amount: {
                    currency: "USD",
                    total: amount
                },
                description: "This is the payment description."
            }]
        };

        const response = await fetch(`${base}/v1/payments/payment`, {
            method: "POST",
            body: JSON.stringify(create_payment_json),
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
        });

        const payment = await response.json();
        for (let i = 0; i < payment.links.length; i++) {
            if (payment.links[i].rel === 'approval_url') {
                return res.json({
                    success: true,
                    message: "here is link approval url",
                    url: payment.links[i].href,
                });
            }
        }
    } catch (error) {
        console.error("Error creating PayPal payment:", error);
        res.status(500).send(error);
    }
});

app.get('/success', async (req, res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;
    const amount = req.query.amount;

    try {
        const token = await generateAccessToken();
        const execute_payment_json = {
            "payer_id": payerId,
            "transactions": [{
                "amount": {
                    "currency": "USD",
                    "total": amount
                }
            }]
        };

        const response = await fetch(`${base}/v1/payments/payment/${paymentId}/execute`, {
            method: "POST",
            body: JSON.stringify(execute_payment_json),
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
        });

        const payment = await response.json();
        console.log("Payment successful:", JSON.stringify(payment));
        res.send('Success');
    } catch (error) {
        console.error("Error executing PayPal payment:", error);
        res.status(500).send(error);
    }
});

app.get('/cancel', (req, res) => res.send('Cancelled'));

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
