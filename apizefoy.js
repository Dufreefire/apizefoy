const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Tesseract = require('tesseract.js');
const app = express();

puppeteer.use(StealthPlugin());

app.get('/api/zefoy-auto', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "Thiếu link video" });

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
        
        console.log("🚀 Truy cập Zefoy...");
        await page.goto('https://zefoy.com/', { waitUntil: 'networkidle2' });

        // --- BƯỚC 1: GIẢI CAPTCHA ---
        try {
            await page.waitForSelector('img.img-thumbnail', { timeout: 5000 });
            const captchaImg = await page.$('img.img-thumbnail');
            
            // Chụp ảnh captcha
            const buffer = await captchaImg.screenshot();
            
            // Dùng AI Tesseract đọc chữ từ ảnh
            console.log("🧠 Đang giải mã Captcha...");
            const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
            const captchaText = text.trim().replace(/\s/g, "");
            console.log(`🔎 AI đọc được: ${captchaText}`);

            // Điền captcha
            await page.type('input[placeholder="Enter the word"]', captchaText);
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.log("Không thấy captcha hoặc lỗi đọc.");
        }

        // --- BƯỚC 2: CHỌN DỊCH VỤ HEARTS ---
        // Zefoy hay đổi cấu trúc, đây là cách tìm nút 'Hearts' linh hoạt
        const buttons = await page.$$('button.btn-primary');
        let heartBtn;
        for (let btn of buttons) {
            const text = await page.evaluate(el => el.innerText, btn);
            if (text.includes('Hearts')) heartBtn = btn;
        }

        if (!heartBtn) {
            await browser.close();
            return res.json({ status: "fail", message: "Dịch vụ Tim đang bảo trì (Soon)." });
        }

        await heartBtn.click();
        await new Promise(r => setTimeout(r, 2000));

        // --- BƯỚC 3: NHẬP LINK VÀ BUFF ---
        await page.waitForSelector('input[type="url"]');
        await page.type('input[type="url"]', videoUrl);
        await page.click('button.btn-search');
        
        console.log("⌛ Đang đợi giây lát...");
        await new Promise(r => setTimeout(r, 7000));

        // Nhấn nút gửi tim cuối cùng
        const sendAction = await page.$('.btn-send');
        if (sendAction) {
            await sendAction.click();
            res.json({ status: "success", message: "Buff tim thành công!" });
        } else {
            res.json({ status: "fail", message: "Đang trong thời gian chờ (Cooldown) hoặc lỗi nút." });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi hệ thống", details: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(3000, () => console.log("API Zefoy AI running on 3000"));