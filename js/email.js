# 10. js/email.js
email_js = '''// ==========================================
// EMAIL / MESSAGING MODULE
// Pesan, Broadcast, Inbox, Sent
// ==========================================

async function sendAppEmail(mode) {
    if (activeEmployeeSession.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        return;
    }

    const prefix = mode === 'mobile' ? 'm' : 'd';
    const recipient = document.getElementById(`${prefix}-email-recipient`).value;
    const subject = document.getElementById(`${prefix}-email-subject`).value.trim();
    const message = document.getElementById(`${prefix}-email-message`).value.trim();

    if (!subject || !message) {
        showToast('Subjek dan isi pesan wajib diisi!', 'error');
        return;
    }

    const newEmail = {
        sender: activeEmployeeSession.id,
        sender_name: activeEmployeeSession.name,
        recipient: recipient,
        subject: subject,
        message: message,
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient.from('emails').insert([newEmail]).select();
    if (error) {
        showToast('Gagal mengirim pesan.', 'error');
        return;
    }

    if (data && data.length > 0) {
        emailsList.unshift({
            id: data[0].id,
            sender: data[0].sender,
            sender_name: data[0].sender_name,
            receiver: data[0].recipient,
            subject: data[0].subject,
            message: data[0].message,
            created_at: data[0].created_at,
            read: true
        });
    }

    showToast('Pesan / Email berhasil dikirim!', 'success');
    if (mode === 'mobile') switchMobileEmailSub('inbox');
    else switchDesktopEmailSub('inbox');

    renderEmails();
    updateEmailBadges();
}

function renderEmails() {
    if (!activeEmployeeSession || activeEmployeeSession.name === 'Tamu') return;
    const userEmail = activeEmployeeSession.id;

    const inboxRows = emailsList.filter(e => e.receiver === userEmail || e.receiver === 'BROADCAST');
    const sentRows = emailsList.filter(e => e.sender === userEmail);

    const readIds = getReadEmailIds();

    // Mobile Inbox
    const mInboxList = document.getElementById('mobile-inbox-list');
    if (mInboxList) {
        if (inboxRows.length === 0) {
            mInboxList.innerHTML = '<p class="text-slate-500 text-center py-4">Kotak masuk kosong.</p>';
        } else {
            mInboxList.innerHTML = inboxRows.map(e => {
                const isRead = readIds.includes(e.id) || e.read || e.sender === userEmail;
                const timeStr = new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border ${!isRead ? 'border-gold-500/50 bg-slate-900/90' : 'border-slate-800'} cursor-pointer hover:border-gold-500 transition">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-bold text-white flex items-center gap-1.5">
                                ${!isRead ? '<span class="w-2 h-2 rounded-full bg-gold-500 inline-block"></span>' : ''}
                                ${e.sender_name || e.sender}
                            </span>
                            <span class="text-[10px] text-slate-400 font-mono">${timeStr}</span>
                        </div>
                        <p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p>
                        <p class="text-[11px] text-slate-300 truncate mt-0.5">${e.message}</p>
                    </div>
                `;
            }).join('');
        }
    }

    // Mobile Sent
    const mSentList = document.getElementById('mobile-sent-list');
    if (mSentList) {
        if (sentRows.length === 0) {
            mSentList.innerHTML = '<p class="text-slate-500 text-center py-4">Belum ada pesan terkirim.</p>';
        } else {
            mSentList.innerHTML = sentRows.map(e => `
                <div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-gold-500 transition">
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-bold text-white">Kepada: ${getEmployeeDisplayName(e.receiver)}</span>
                        <span class="text-[10px] text-slate-400 font-mono">${new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p>
                </div>
            `).join('');
        }
    }

    // Desktop Inbox
    const dInboxTbody = document.getElementById('desktop-inbox-tbody');
    if (dInboxTbody) {
        if (inboxRows.length === 0) {
            dInboxTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Kotak masuk kosong.</td></tr>';
        } else {
            dInboxTbody.innerHTML = inboxRows.map(e => {
                const isRead = readIds.includes(e.id) || e.read || e.sender === userEmail;
                const timeStr = new Date(e.created_at).toLocaleString('id-ID');
                const isBroadcast = e.receiver === 'BROADCAST';
                return `
                    <tr class="hover:bg-slate-900/50 ${!isRead ? 'bg-slate-900/60 font-semibold' : ''}">
                        <td class="p-3 font-mono text-slate-400 text-[11px]">${timeStr}</td>
                        <td class="p-3 text-white">${e.sender_name || e.sender}</td>
                        <td class="p-3">
                            <div class="text-white font-bold">${e.subject}</div>
                            <div class="text-slate-400 truncate max-w-xs font-normal">${e.message}</div>
                        </td>
                        <td class="p-3 text-center">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isBroadcast ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}">
                                ${isBroadcast ? 'Broadcast' : 'Pribadi'}
                            </span>
                        </td>
                        <td class="p-3 text-right space-x-1">
                            <button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Baca</button>
                            <button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Desktop Sent
    const dSentTbody = document.getElementById('desktop-sent-tbody');
    if (dSentTbody) {
        if (sentRows.length === 0) {
            dSentTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Belum ada pesan terkirim.</td></tr>';
        } else {
            dSentTbody.innerHTML = sentRows.map(e => `
                <tr class="hover:bg-slate-900/50">
                    <td class="p-3 font-mono text-slate-400 text-[11px]">${new Date(e.created_at).toLocaleString('id-ID')}</td>
                    <td class="p-3 text-white">${getEmployeeDisplayName(e.receiver)}</td>
                    <td class="p-3 text-white font-semibold">${e.subject}</td>
                    <td class="p-3 text-right space-x-1">
                        <button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Lihat</button>
                        <button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }
    }
}

function openEmailDetail(emailId) {
    const email = emailsList.find(e => e.id === emailId);
    if (!email) return;

    activeSelectedEmail = email;
    markEmailAsRead(email.id);

    document.getElementById('detail-email-sender').innerText = email.sender_name || email.sender;
    document.getElementById('detail-email-receiver').innerText = getEmployeeDisplayName(email.receiver);
    document.getElementById('detail-email-time').innerText = new Date(email.created_at).toLocaleString('id-ID');
    document.getElementById('detail-email-subject').innerText = email.subject;
    document.getElementById('detail-email-message').innerText = email.message;

    const btnReply = document.getElementById('btn-reply-email');
    if (email.sender === activeEmployeeSession.id) {
        btnReply.classList.add('hidden');
    } else {
        btnReply.classList.remove('hidden');
    }

    document.getElementById('email-detail-modal').classList.remove('hidden');
}

function closeEmailDetailModal() {
    document.getElementById('email-detail-modal').classList.add('hidden');
    activeSelectedEmail = null;
}

function replyEmail() {
    if (!activeSelectedEmail) return;
    const targetSender = activeSelectedEmail.sender;
    const subjectReply = "Re: " + activeSelectedEmail.subject;

    closeEmailDetailModal();

    if (document.getElementById('view-desktop').classList.contains('hidden')) {
        switchMobileTab('email');
        switchMobileEmailSub('compose');
        document.getElementById('m-email-recipient').value = targetSender;
        document.getElementById('m-email-subject').value = subjectReply;
        document.getElementById('m-email-message').value = "\\n\\n--- Pesan Dibalas ---\\n" + activeSelectedEmail.message;
    } else {
        switchDesktopTab('email');
        switchDesktopEmailSub('compose');
        document.getElementById('d-email-recipient').value = targetSender;
        document.getElementById('d-email-subject').value = subjectReply;
        document.getElementById('d-email-message').value = "\\n\\n--- Pesan Dibalas ---\\n" + activeSelectedEmail.message;
    }
}

async function deleteEmailItem(emailId) {
    showConfirm('Hapus Pesan', 'Apakah Anda yakin ingin menghapus pesan ini?', async () => {
        await supabaseClient.from('emails').delete().eq('id', emailId);
        emailsList = emailsList.filter(e => e.id !== emailId);
        renderEmails();
        updateEmailBadges();
        showToast('Pesan berhasil dihapus.', 'success');
    });
}
'''

with open(f"{output_dir}/js/email.js", "w", encoding="utf-8") as f:
    f.write(email_js)

print("✅ js/leaves.js created")
print("✅ js/email.js created")