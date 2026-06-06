const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

async function main() {
  console.log("Starting Python server...");
  const server = spawn('python', ['server.py'], { stdio: 'inherit' });

  // Wait 3 seconds for server to boot
  await new Promise(resolve => setTimeout(resolve, 3000));

  let browser;
  let success = true;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Listen to console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log(`[Browser ERROR] ${text}`);
        if (!text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
          success = false;
        }
      }
    });

    page.on('pageerror', err => {
      console.error('[Browser Page Error]', err);
      success = false;
    });

    const urls = [
      'http://localhost:8000/anatomy1/index.html',
      'http://localhost:8000/anatomy2/index.html',
      'http://localhost:8000/anatomy3/index.html',
    ];

    for (const url of urls) {
      console.log(`\nNavigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // 1. Verify Pomodoro Timer Display
      const pomo = await page.$('#pomo-timer-display');
      if (pomo) {
        const text = await page.evaluate(el => el.textContent, pomo);
        console.log(`  Pomodoro display exists. Default value: ${text}`);
        if (!/^\d{1,2}:\d{2}$/.test(text)) {
          console.error(`  Error: Default timer value is "${text}", expected a format like "MM:SS"!`);
          success = false;
        }
      } else {
        console.error('  Error: Pomodoro display "#pomo-timer-display" is missing!');
        success = false;
      }

      // 2. Open Settings Modal
      console.log('  Opening Settings Modal...');
      await page.click('#btn-settings');
      await new Promise(resolve => setTimeout(resolve, 200));

      // 3. Verify Model Select exists
      const modelSelect = await page.$('#model-select');
      if (modelSelect) {
        console.log('  Model selector "#model-select" exists.');
      } else {
        console.error('  Error: Model selector "#model-select" is missing!');
        success = false;
      }

      // 4. Verify Bypass Toggle exists and test clicking it
      const bypassBtn = await page.$('#bypass-toggle-btn');
      if (bypassBtn) {
        const initialText = await page.evaluate(el => el.textContent.trim(), bypassBtn);
        console.log(`  Bypass button found. Initial text: ${initialText}`);

        // Click bypass toggle
        console.log('  Clicking bypass toggle...');
        await page.click('#bypass-toggle-btn');
        await new Promise(resolve => setTimeout(resolve, 100));

        const toggledText = await page.evaluate(el => el.textContent.trim(), bypassBtn);
        console.log(`  Bypass button text after click: ${toggledText}`);

        if (initialText === toggledText) {
          console.error('  Error: Clicking bypass toggle did not change its label!');
          success = false;
        }

        // Revert it
        await page.click('#bypass-toggle-btn');
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.error('  Error: Bypass toggle button "#bypass-toggle-btn" is missing!');
        success = false;
      }
    }

  } catch (err) {
    console.error("Test execution failed:", err);
    success = false;
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log("Stopping Python server...");
    server.kill();
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  if (success) {
    console.log("\nALL ENRICHMENT TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("\nENRICHMENT TEST SUITE FAILED!");
    process.exit(1);
  }
}

main();
