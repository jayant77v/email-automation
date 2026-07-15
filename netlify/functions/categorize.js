const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { recipient, replyContent } = JSON.parse(event.body);

    let browser = null;

    try {
        // 1. Setup Browser for Netlify Environment
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // 2. Login Logic
        // Using Google's direct login URL
        await page.goto('https://accounts.google.com/signin/v2/identifier?service=mail', { waitUntil: 'networkidle2' });
        
        // Enter Email
        await page.type('input[type="email"]', process.env.GMAIL_USER);
        await page.click('#identifierNext');
        
        // Wait for Password field and enter it
        await page.waitForSelector('input[type="password"]', { visible: true });
        await page.type('input[type="password"]', process.env.GMAIL_PASS);
        await page.click('#passwordNext');

        // 3. Navigate to Compose
        // Wait for the inbox to load properly
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Gmail URL shortcut for a new compose window
        await page.goto(`https://mail.google.com/mail/u/0/#inbox?compose=new`, { waitUntil: 'networkidle2' });

        // 4. Fill and Send
        // Wait for the 'To' field (Gmail uses a specific role for this)
        await page.waitForSelector('input[role="combobox"]');
        await page.type('input[role="combobox"]', recipient);
        
        // Tab through to Subject and Body
        await page.keyboard.press('Tab'); 
        await page.keyboard.type('ShadowFlow: Automated Response'); // Subject
        
        await page.keyboard.press('Tab');
        await page.keyboard.type(replyContent); // The AI generated reply

        // 5. Trigger Send (Shortcut: Ctrl + Enter)
        await page.keyboard.down('Control');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Control');

        // Give it a second to finish sending
        await new Promise(r => setTimeout(r, 2000));

        await browser.close();

        return {
            statusCode: 200,
            body: JSON.stringify({ status: "Success", message: "Reply sent via Gmail automation." })
        };

    } catch (error) {
        console.error("Automation Error:", error);
        if (browser) await browser.close();
        
        return {
            statusCode: 500,
            body: JSON.stringify({ status: "Error", message: error.message })
        };
    }
};
