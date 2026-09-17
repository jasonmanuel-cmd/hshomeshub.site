/* Shared lead delivery. No analytics identifiers or personal data in URLs. */
(() => {
  const property = '585 N Wendy Dr, Newbury Park, CA 91320';
  const read = key => { try { return sessionStorage.getItem(key); } catch (_) { return null; } };
  const store = (key, value) => { try { sessionStorage.setItem(key, value); } catch (_) {} };
  let attribution = {};
  try { attribution = JSON.parse(read('__attr') || '{}'); } catch (_) {}
  const query = new URLSearchParams(location.search);
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','gbraid','wbraid','msclkid']) {
    if (query.get(key)) attribution[key] = query.get(key).slice(0, 500);
  }
  attribution.landing_page = attribution.landing_page || location.origin + location.pathname;
  attribution.first_touch = attribution.first_touch || new Date().toISOString();
  store('__attr', JSON.stringify(attribution));

  async function post(url, data, crm) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'}, body:JSON.stringify(data), signal:controller.signal});
      if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('Delivery failed');
      const result = await response.json();
      if (crm ? result.success !== true : result.success === false || result.ok === false || result.errors) throw new Error('Delivery rejected');
      return true;
    } finally { clearTimeout(timer); }
  }

  for (const id of ['contactForm','openHouseForm','registrationForm','inquiryForm']) {
    const form = document.getElementById(id);
    if (!form) continue;
    const status = document.createElement('p');
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    form.append(status);
    const trap = document.createElement('input');
    trap.name = '_gotcha'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.hidden = true;
    form.append(trap);
    const privacy = document.createElement('p');
    privacy.style.cssText = 'font-size:12px;margin-top:12px';
    const privacyLink = document.createElement('a'); privacyLink.href='/privacy.html'; privacyLink.textContent='Privacy and contact information';
    privacy.append(privacyLink); form.append(privacy);
    let sending = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      const fields = new FormData(form);
      if (fields.get('_gotcha')) return;
      const name = String(fields.get('name') || '').trim();
      const email = String(fields.get('email') || '').trim();
      const phone = String(fields.get('phone') || '').trim();
      const preference = String(fields.get('contact_preference') || fields.get('contact') || 'either');
      if (!name || (!email && !phone)) { status.textContent='Enter your name and an email or phone number.'; return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent='Enter a valid email address.'; return; }
      if (phone && (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g,'').length < 10 || phone.replace(/\D/g,'').length > 15)) { status.textContent='Enter a valid phone number, including area code.'; return; }
      if ((preference === 'email' && !email) || (['phone','text','sms'].includes(preference) && !phone)) { status.textContent='Provide contact details for your selected contact method.'; return; }
      const button = form.querySelector('[type="submit"]');
      const label = button.textContent;
      sending=true; button.disabled=true; button.textContent='Sending…'; status.textContent='';
      const now = new Date();
      const source = id === 'contactForm' ? 'Tour Request Form' : id === 'inquiryForm' ? 'inquiry_form' : id === 'registrationForm' ? 'Open House QR Code' : 'Open House Website';
      const data = {...Object.fromEntries(fields), name,email,phone,contact_preference:preference,property,location:property,source,date_time:now.toLocaleString('en-US'),submission_date:now.toISOString(),...attribution};
      delete data._gotcha;
      try {
        try { await post('https://www.harbisonstandard.com/hq/api/openhouse', data, true); }
        catch (_) { await post('https://formspree.io/f/xqpkdwrp', {...data,_subject:source,_replyto:email}, false); }
        for (const [key,value] of Object.entries({Name:name,Email:email,Phone:phone,Time:data.date_time})) store('lastSubmission'+key,value);
        // Fire only after confirmed delivery, never on page views or validation failure.
        try { if (typeof window.gtag === 'function') window.gtag('event','generate_lead',{form_name:id}); } catch (_) {}
        try { if (typeof window.fbq === 'function') window.fbq('track','Lead'); } catch (_) {}
        try { if (typeof window.va === 'function') window.va('event',{name:'lead_received',data:{form:id}}); } catch (_) {}
        location.assign('/thank-you.html');
      } catch (_) {
        status.textContent='Your request could not be confirmed. Please try again or call/text 661-472-7499.';
        sending=false; button.disabled=false; button.textContent=label;
      }
    });
  }
})();
