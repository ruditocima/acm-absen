async function sendAppEmail(mode) {
    if (activeEmployeeSession.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        return;
    }
    const prefix = mode === 'mobile' ? 'm' : 'd';
    const recipient = document.getElementById(prefix + '-email-recipient').value;
    const subject = document.getElementById(prefix + '-email-subject').value.trim();
    const message = document.getElementById(prefix + '-email-message').value.trim();
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
    const result = await supabaseClient.from('emails').insert([newEmail]).select();
    if (result.error) {
        showToast('Gagal mengirim pesan.', 'error');
        return;
    }
    if (result.data && result.data.length > 0) {
        emailsList.unshift({
            id: result.data[0].id,
            sender: result.data[0].sender,
            sender_name: result.data[0].sender_name,
            receiver: result.data[0].recipient,
            subject: result.data[0].subject,
            message: result.data[0].message,
            created_at: result.data[0].created_at,
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
    const inboxRows = emailsList.filter(function(e) { return e.receiver === userEmail || e.receiver === 'BROADCAST'; });
    const sentRows = emailsList.filter(function(e) { return e.sender === userEmail; });
    const readIds = getReadEmailIds();

    const mInboxList = document.getElementById('mobile-inbox-list');
    if (mInboxList) {
        if (inboxRows.length === 0) {
            mInboxList.innerHTML = '<p class="text-slate-500 text-center py-4">Kotak masuk kosong.</p>';
        } else {
            mInboxList.innerHTML = inboxRows.map(function(e) {
                const isRead = readIds.includes(e.id) || e.read || e.sender === userEmail;
                const timeStr = new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const unreadDot = !isRead ? '<span class="w-2 h-2 rounded-full bg-gold-500 inline-block"></span>' : '';
                const borderClass = !isRead ? 'border-gold-500/50 bg-slate-900/90' : 'border-slate-800';
                return `
                    <div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border ${borderClass} cursor-pointer hover:border-gold-500 transition">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-bold text-white flex items-center gap-1.5">${unreadDot}${e.sender_name || e.sender}</span>
                            <span class="text-[10px] text-slate-400 font-mono">${timeStr}</span>
                        </div>
                        <p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p>
                        <p class="text-[11px] text-slate-300 truncate mt-0.5">${e.message}</p>
                    </div>`;
            }).join('');
        }
    }

    const mSentList = document.getElementById('mobile-sent-list');
    if (mSentList) {
        if (sentRows.length === 0) {
            mSentList.innerHTML = '<p class="text-slate-500 text-center py-4">Belum ada pesan terkirim.</p>';
        } else {
            mSentList.innerHTML = sentRows.map(function(e) {
                const timeStr = new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-gold-500 transition">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-bold text-white">Kepada: ${getEmployeeDisplayName(e.receiver)}</span>
                            <span class="text-[10px] text-slate-400 font-mono">${timeStr}</span>
                        </div>
                        <p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p>
                    </div>`;
            }).join('');
        }
    }

    const dInboxTbody = document.getElementById('desktop-inbox-tbody');
    if (dInboxTbody) {
        if (inboxRows.length === 0) {
            dInboxTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Kotak masuk kosong.</td></tr>';
        } else {
            dInboxTbody.innerHTML = inboxRows.map(function(e) {
                const isRead = readIds.includes(e.id) || e.read || e.sender === userEmail;
                const timeStr = new Date(e.created_at).toLocaleString('id-ID');
                const isBroadcast = e.receiver === 'BROADCAST';
                const typeBadge = isBroadcast ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400';
                const typeLabel = isBroadcast ? 'Broadcast' : 'Pribadi';
                const rowClass = !isRead ? 'bg-slate-900/60 font-semibold' : '';
                return `
                    <tr class="hover:bg-slate-900/50 ${rowClass}">
                        <td class="p-3 font-mono text-slate-400 text-[11px]">${timeStr}</td>
                        <td class="p-3 text-white">${e.sender_name || e.sender}</td>
                        <td class="p-3">
                            <div class="text-white font-bold">${e.subject}</div>
                            <div class="text-slate-400 truncate max-w-xs font-normal">${e.message}</div>
                        </td>
                        <td class="p-3 text-center">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${typeBadge}">${typeLabel}</span>
                        </td>
                        <td class="p-3 text-right space-x-1">
                            <button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Baca</button>
                            <button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>`;
            }).join('');
        }
    }

    const dSentTbody = document.getElementById('desktop-sent-tbody');
    if (dSentTbody) {
        if (sentRows.length === 0) {
            dSentTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Belum ada pesan terkirim.</td></tr>';
        } else {
            dSentTbody.innerHTML = sentRows.map(function(e) {
                const timeStr = new Date(e.created_at).toLocaleString('id-ID');
                return `
                    <tr class="hover:bg-slate-900/50">
                        <td class="p-3 font-mono text-slate-400 text-[11px]">${timeStr}</td>
                        <td class="p-3 text-white">${getEmployeeDisplayName(e.receiver)}</td>
                        <td class="p-3 text-white font-semibold">${e.subject}</td>
                        <td class="p-3 text-right space-x-1">
                            <button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Lihat</button>
                            <button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>`;
            }).join('');
        }
    }
}

function openEmailDetail(emailId) {
    const email = emailsList.find(function(e) { return e.id === emailId; });
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
        document.getElementById('m-email-message').value = "\n\n--- Pesan Dibalas ---\n" + activeSelectedEmail.message;
    } else {
        switchDesktopTab('email');
        switchDesktopEmailSub('compose');
        document.getElementById('d-email-recipient').value = targetSender;
        document.getElementById('d-email-subject').value = subjectReply;
        document.getElementById('d-email-message').value = "\n\n--- Pesan Dibalas ---\n" + activeSelectedEmail.message;
    }
}

async function deleteEmailItem(emailId) {
    showConfirm('Hapus Pesan', 'Apakah Anda yakin ingin menghapus pesan ini?', async function() {
        await supabaseClient.from('emails').delete().eq('id', emailId);
        emailsList = emailsList.filter(function(e) { return e.id !== emailId; });
        renderEmails();
        updateEmailBadges();
        showToast('Pesan berhasil dihapus.', 'success');
    });
}