// test-sendexa.js
// Run: node test-sendexa.js
// This tries every possible Sendexa endpoint to find which one works

const credentials = 'c21zX2E3ZjE1ZmM4OjY1ODM0MWJlMmE3NDAzZjQ=';

const endpoints = [
  { url: 'https://api.sendexa.co/v1/otp/request',  body: { phone: '0545255690', from: 'Exa Auth', message: 'Test {code}', pinLength: 6, pinType: 'NUMERIC' } },
  { url: 'https://api.sendexa.co/v1/otp/send',     body: { phone: '0545255690', from: 'Exa Auth', message: 'Test {code}', pinLength: 6, pinType: 'NUMERIC' } },
  { url: 'https://api.sendexa.co/v2/otp/request',  body: { phone: '0545255690', from: 'Exa Auth', message: 'Test {code}', pinLength: 6, pinType: 'NUMERIC' } },
  { url: 'https://api.sendexa.co/v2/otp/send',     body: { phone: '0545255690', from: 'Exa Auth', message: 'Test {code}', pinLength: 6, pinType: 'NUMERIC' } },
  { url: 'https://api.sendexa.co/v1/sms',          body: { phone: '0545255690', from: 'Exa Auth', message: 'Test code 123456' } },
  { url: 'https://api.sendexa.co/v1/sms/send',     body: { phone: '0545255690', from: 'Exa Auth', message: 'Test code 123456' } },
  { url: 'https://api.sendexa.co/sms/send',        body: { phone: '0545255690', from: 'Exa Auth', message: 'Test code 123456' } },
  { url: 'https://api.sendexa.co/otp/request',     body: { phone: '0545255690', from: 'Exa Auth', message: 'Test {code}', pinLength: 6, pinType: 'NUMERIC' } },
];

async function test() {
  for (const ep of endpoints) {
    try {
      const res  = await fetch(ep.url, {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(ep.body),
      });
      const data = await res.json();
      console.log(`\n[${res.status}] ${ep.url}`);
      console.log('Response:', JSON.stringify(data));
      if (res.status !== 404 && !data.error?.includes('Route not found')) {
        console.log('\n✅ THIS IS THE CORRECT ENDPOINT ⬆️');
      }
    } catch (err) {
      console.log(`\n[ERR] ${ep.url} — ${err.message}`);
    }
  }
}

test();