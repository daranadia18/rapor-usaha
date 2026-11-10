// Bantuan form untuk login/register/tambah UMKM: tombol tampilkan sandi dan galat per kolom.

export function pasangToggleSandi(root = document) {
  root.querySelectorAll('[data-toggle-pw]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('aria-controls'));
      const tampil = input.type === 'password';
      input.type = tampil ? 'text' : 'password';
      btn.textContent = tampil ? 'Sembunyikan' : 'Tampilkan';
      btn.setAttribute('aria-pressed', String(tampil));
    });
  });
}

export function bersihkanGalat(form) {
  form.querySelectorAll('.field-error').forEach(e => { e.hidden = true; e.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach(i => {
    i.removeAttribute('aria-invalid');
    // buang id galat dari aria-describedby agar tidak menumpuk
    const sisa = (i.getAttribute('aria-describedby') || '').split(/\s+/).filter(x => x && !x.startsWith('err-'));
    if (sisa.length) i.setAttribute('aria-describedby', sisa.join(' ')); else i.removeAttribute('aria-describedby');
  });
  const a = form.querySelector('#form-alert');
  if (a) a.innerHTML = '';
}

export function galatKolom(form, nama, pesan) {
  const err = form.querySelector('#err-' + nama);
  const input = form.querySelector('#' + nama) || form.querySelector(`[name="${nama}"]`);
  if (err) { err.textContent = pesan; err.hidden = false; }
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    if (err) {
      const ids = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      ids.add(err.id);
      input.setAttribute('aria-describedby', [...ids].join(' '));
    }
  }
}

// Cocokkan pesan galat API ke kolom lewat kata kunci; sisanya jadi alert umum
export function petakanGalat(form, errors, kataKunci) {
  const umum = [];
  errors.forEach(pesan => {
    const p = pesan.toLowerCase();
    const kolom = Object.keys(kataKunci).find(k => kataKunci[k].some(kata => p.includes(kata)));
    if (kolom) galatKolom(form, kolom, pesan); else umum.push(pesan);
  });
  return umum;
}
