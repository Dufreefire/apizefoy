const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
const Tesseract = require('tesseract.js');

puppeteer.use(StealthPlugin());
const app = express();

app.get('/api/zefoy', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "Thiếu tham số ?url=" });

    let browser = null;
    try {
        // Cấu hình Chromium chạy trên Serverless Vercel
        browser = await puppeteer.launch({
            args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto('https://zefoy.com/', { waitUntil: 'networkidle2', timeout: 30000 });

        // Bước 1: Giải Captcha
        const captchaImg = await page.$('img.img-thumbnail');
        if (captchaImg) {
            const buffer = await captchaImg.screenshot();
            const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
            const captchaText = text.trim().replace(/\s/g, "");
            await page.type('input[placeholder="Enter the word"]', captchaText);
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 4000));
        }

        // Bước 2: Tìm và chọn mục Hearts
        const buttons = await page.$$('button.btn-primary');
        let heartBtn = null;
        for (let btn of buttons) {
            const btnText = await page.evaluate(el => el.innerText, btn);
            if (btnText.includes('Hearts')) { heartBtn = btn; break; }
        }

        if (!heartBtn) return res.json({ status: "fail", message: "Nút Hearts đang bảo trì (Soon) hoặc sai Captcha." });

        await heartBtn.click();
        await new Promise(r => setTimeout(r, 2000));

        // Bước 3: Nhập link và Buff
        await page.waitForSelector('input[type="url"]');
        await page.type('input[type="url"]', videoUrl);
        await page.click('button.btn-search');
        
        await new Promise(r => setTimeout(r, 7000));

        const sendBtn = await page.$('.btn-send');
        if (sendBtn) {
            await sendBtn.click();
            res.json({ status: "success", message: "Đã nhấn nút gửi tim!" });
        } else {
            res.json({ status: "fail", message: "Không tìm thấy nút Send (Có thể đang Cooldown)." });
        }

    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

module.exports = app;
