const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
const Tesseract = require('tesseract.js');

puppeteer.use(StealthPlugin());
const app = express();

app.get('/api/zefoy', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "Thiếu link" });

    let browser = null;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.goto('https://zefoy.com/', { waitUntil: 'networkidle2' });

        // Giải Captcha bằng AI
        const captchaImg = await page.$('img.img-thumbnail');
        if (captchaImg) {
            const buffer = await captchaImg.screenshot();
            const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
            const captchaText = text.trim().replace(/\s/g, "");
            await page.type('input[placeholder="Enter the word"]', captchaText);
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 5000));
        }

        // Tìm nút Hearts
        const buttons = await page.$$('button.btn-primary');
        let heartBtn;
        for (let btn of buttons) {
            const btnText = await page.evaluate(el => el.innerText, btn);
            if (btnText.includes('Hearts')) heartBtn = btn;
        }

        if (!heartBtn) {
            return res.json({ status: "fail", message: "Dịch vụ đang bảo trì." });
        }

        await heartBtn.click();
        await new Promise(r => setTimeout(r, 2000));

        // Nhập link video
        await page.type('input[type="url"]', videoUrl);
        await page.click('button.btn-search');
        await new Promise(r => setTimeout(r, 7000));

        const sendBtn = await page.$('.btn-send');
        if (sendBtn) {
            await sendBtn.click();
            res.json({ status: "success", message: "Buff thành công!" });
        } else {
            res.json({ status: "fail", message: "Cooldown hoặc sai Captcha." });
        }

    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    } finally {
        if (browser !== null) await browser.close();
    }
});

module.exports = app;
