const express = require("express");
const httpProxy = require("http-proxy");

const app = express();
const PORT = 8000;

// Base URL of YOur S3 Bucket
const BasePath = 'https://bucket-clone-vercel.s3.ap-south-1.amazonaws.com/__outputs';


const proxy = httpProxy.createProxyServer({});

app.use((req, res) => {
    try {
        const hostname = req.hostname;
        const subdomain = hostname.split('.')[0]; // Extract subdomain

       
        const path = req.url === '/' ? '/index.html' : req.url;

        const target = `${BasePath}/${subdomain}${path}`;

    
        proxy.web(req, res, { target, changeOrigin: true });
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).send("Internal server error");
    }
});


proxy.on('error', (err, req, res) => {
    console.error("Proxy server error:", err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Something went wrong. Please try again later.');
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
