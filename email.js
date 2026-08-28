
# ============================================================
# FILE 10: email.js
# ============================================================
email_js = '''// ============================================================
// EMAIL: Send, Render, Detail, Reply, Delete
// ============================================================

function getReadEmailIds() {
    try {
        var userId = Store.get('activeEmployeeSession').id || 'tamu';
        var stored = localStorage.getItem('read_emails_' + userId);
        return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
}

function markEmailAsRead(emailId) {
    var userId = Store.get('activeEmployeeSession').id || 'tamu';
    var readIds = getReadEmailIds();
    if (readIds.indexOf(emailId) < 0) {
        readIds.push(emailId);
        localStorage.setItem('read_emails_' + userId, JSON.stringify(readIds));
    }
    var emailsList = Store.get('emailsList');
    var email = emailsList.find(function(e) { return e.id === emailId; });
    if (email) email.read = true;
    updateEmailBadges();
    renderEmails();
}

function getEmployeeDisplayName(emailOrId) {
    if (!emailOrId || emailOrId === 'BROADCAST') return 'BROADCAST (Semua Karyawan)';
    var employees = Store.get('employees');
    var emp = employees.find(function(e) { return e.id === emailOrId; });
    return emp ? emp.name : emailOrId;
}

function populateEmailRecipients() {
    var mSelect = document.getElementById('m-email-recipient');
    var dSelect = document.getElementById('d-email-recipient');
    var currentUserId = Store.get('activeEmployeeSession').id ? Store.get('activeEmployeeSession').id.toLowerCase() : '';
    var employees = Store.get('employees');

    var optionsHtml = '<option value="BROADCAST">BROADCAST (Kirim ke Seluruh Karyawan)</option>' +
        employees.filter(function(emp) { return emp.id.toLowerCase() !== currentUserId && emp.status === 'Approved'; })
            .map(function(emp) { return '<option value="' + escapeHtml(emp.id) + '">' + escapeHtml(emp.name) + ' - ' + escapeHtml(emp.position) + '</option>'; }).join('');

    if (mSelect) mSelect.innerHTML = optionsHtml;
    if (dSelect) dSelect.innerHTML = optionsHtml;
}

function updateEmailBadges() {
    var mBadge = document.getElementById('mobile-email-badge');
    var sBadge = document.getElementById('sidebar-email-badge');
    var session = Store.get('activeEmployeeSession');

    if (!session || session.name === 'Tamu') {
        if (mBadge) mBadge.classList.add('hidden');
        if (sBadge) sBadge.classList.add('hidden');
        return;
    }

    var userEmail = session.id;
    var readIds = getReadEmailIds();
    var emailsList = Store.get('emailsList');
    var unreadCount = emailsList.filter(function(e) {
        var isForMe = (e.receiver === userEmail || e.receiver === 'BROADCAST');
        var isNotMyOwn = (e.sender !== userEmail);
        var isRead = readIds.indexOf(e.id) >= 0 || e.read;
        return isForMe && isNotMyOwn && !isRead;
    }).length;

    if (mBadge) {
        if (unreadCount > 0) {
            mBadge.innerText = unreadCount;
            mBadge.classList.remove('hidden');
        } else {
            mBadge.classList.add('hidden');
        }
    }
    if (sBadge) {
        if (unreadCount > 0) {
            sBadge.innerText = unreadCount;
            sBadge.classList.remove('hidden');
        } else {
            sBadge.classList.add('hidden');
        }
    }
}

function renderEmails() {
    var session = Store.get('activeEmployeeSession');
    if (!session || session.name === 'Tamu') return;

    var userEmail = session.id;
    var emailsList = Store.get('emailsList');
    var inboxRows = emailsList.filter(function(e) { return e.receiver === userEmail || e.receiver === 'BROADCAST'; });
    var sentRows = emailsList.filter(function(e) { return e.sender === userEmail; });
    var readIds = getReadEmailIds();

    // Mobile Inbox
    var mInboxList = document.getElementById('mobile-inbox-list');
    if (mInboxList) {
        if (inboxRows.length === 0) {
            mInboxList.innerHTML = '<p class="text-slate-500 text-center py-4">Kotak masuk kosong.</p>';
        } else {
            mInboxList.innerHTML = inboxRows.map(function(e) {
                var isRead = readIds.indexOf(e.id) >= 0 || e.read || e.sender === userEmail;
                var timeStr = formatWIBTime(e.created_at);
                return '<div onclick="openEmailDetail(' + e.id + ')" class="glass-card p-3 rounded-xl border ' + (!isRead ? 'border-gold-500/50 bg-slate-900/90' : 'border-slate-800') + ' cursor-pointer hover:border-gold-500 transition">' +
                    '<div class="flex justify-between items-start mb-1">' +
                    '<span class="font-bold text-white flex items-center gap-1.5">' + (!isRead ? '<span class="w-2 h-2 rounded-full bg-gold-500 inline-block"></span>' : '') + escapeHtml(e.sender_name || e.sender) + '</span>' +
                    '<span class="text-[10px] text-slate-400 font-mono">' + timeStr + '</span></div>' +
                    '<p class="text-xs font-semibold text-gold-400 truncate">' + escapeHtml(e.subject) + '</p>' +
                    '<p class="text-[11px] text-slate-300 truncate mt-0.5">' + escapeHtml(e.message) + '</p></div>';
            }).join('');
        }
    }

    // Mobile Sent
    var mSentList = document.getElementById('mobile-sent-list');
    if (mSentList) {
        if (sentRows.length === 0) {
            mSentList.innerHTML = '<p class="text-slate-500 text-center py-4">Belum ada pesan terkirim.</p>';
        } else {
            mSentList.innerHTML = sentRows.map(function(e) {
                return '<div onclick="openEmailDetail(' + e.id + ')" class="glass-card p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-gold-500 transition">' +
                    '<div class="flex justify-between items-start mb-1">' +
                    '<span class="font-bold text-white">Kepada: ' + escapeHtml(getEmployeeDisplayName(e.receiver)) + '</span>' +
                    '<span class="text-[10px] text-slate-400 font-mono">' + formatWIBTime(e.created_at) + '</span></div>' +
                    '<p class="text-xs font-semibold text-gold-400 truncate">' + escapeHtml(e.subject) + '</p></div>';
            }).join('');
        }
    }

    // Desktop Inbox
    var dInboxTbody = document.getElementById('desktop-inbox-tbody');
    if (dInboxTbody) {
        if (inboxRows.length === 0) {
            dInboxTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Kotak masuk kosong.</td></tr>';
        } else {
            dInboxTbody.innerHTML = inboxRows.map(function(e) {
                var isRead = readIds.indexOf(e.id) >= 0 || e.read || e.sender === userEmail;
                var timeStr = formatWIBDateTime(e.created_at);
                var isBroadcast = e.receiver === 'BROADCAST';
                return '<tr class="hover:bg-slate-900/50 ' + (!isRead ? 'bg-slate-900/60 font-semibold' : '') + '">' +
                    '<td class="p-3 font-mono text-slate-400 text-[11px]">' + timeStr + '</td>' +
                    '<td class="p-3 text-white">' + escapeHtml(e.sender_name || e.sender) + '</td>' +
                    '<td class="p-3"><div class="text-white font-bold">' + escapeHtml(e.subject) + '</div><div class="text-slate-400 truncate max-w-xs font-normal">' + escapeHtml(e.message) + '</div></td>' +
                    '<td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ' + (isBroadcast ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400') + '">' + (isBroadcast ? 'Broadcast' : 'Pribadi') + '</span></td>' +
                    '<td class="p-3 text-right space-x-1"><button onclick="openEmailDetail(' + e.id + ')" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Baca</button><button onclick="deleteEmailItem(' + e.id + ')" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button></td></tr>';
            }).join('');
        }
    }

    // Desktop Sent
    var dSentTbody = document.getElementById('desktop-sent-tbody');
    if (dSentTbody) {
        if (sentRows.length === 0) {
            dSentTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Belum ada pesan terkirim.</td></tr>';
        } else {
            dSentTbody.innerHTML = sentRows.map(function(e) {
                return '<tr class="hover:bg-slate-900/50">' +
                    '<td class="p-3 font-mono text-slate-400 text-[11px]">' + formatWIBDateTime(e.created_at) + '</td>' +
                    '<td class="p-3 text-white">' + escapeHtml(getEmployeeDisplayName(e.receiver)) + '</td>' +
                    '<td class="p-3 text-white font-semibold">' + escapeHtml(e.subject) + '</td>' +
                    '<td class="p-3 text-right space-x-1"><button onclick="openEmailDetail(' + e.id + ')" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Lihat</button><button onclick="deleteEmailItem(' + e.id + ')" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button></td></tr>';
            }).join('');
        }
    }
}

async function sendAppEmail(mode) {
    var session = Store.get('activeEmployeeSession');
    if (session.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        return;
    }

    var prefix = mode === 'mobile' ? 'm' : 'd';
    var recipient = document.getElementById(prefix + '-email-recipient').value;
    var subject = document.getElementById(prefix + '-email-subject').value.trim();
    var message = document.getElementById(prefix + '-email-message').value.trim();

    if (!subject || !message) {
        showToast('Subjek dan isi pesan wajib diisi!', 'error');
        return;
    }

    var btn = document.querySelector('#' + (prefix === 'm' ? 'm-email-compose-section' : 'd-email-compose-section') + ' button[onclick="sendAppEmail(\'' + mode + '\')"]');
    setButtonLoading(btn, 'Mengirim...');

    var newEmail = {
        sender: session.id,
        sender_name: session.name,
        recipient: recipient,
        subject: subject,
        message: message,
        created_at: new Date().toISOString()
    };

    var result = await supabaseClient.from('emails').insert([newEmail]).select();

    resetButtonLoading(btn);

    if (result.error) {
        showToast('Gagal mengirim pesan.', 'error');
        return;
    }

    if (result.data && result.data.length > 0) {
        var emailsList = Store.get('emailsList');
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
        Store.set('emailsList', emailsList.slice());
    }

    showToast('Pesan berhasil dikirim!', 'success');
    if (mode === 'mobile') switchMobileEmailSub('inbox');
    else switchDesktopEmailSub('inbox');
    renderEmails();
    updateEmailBadges();
}

function openEmailDetail(emailId) {
    var emailsList = Store.get('emailsList');
    var email = emailsList.find(function(e) { return e.id === emailId; });
    if (!email) return;

    Store.set('activeSelectedEmail', email);
    markEmailAsRead(email.id);

    document.getElementById('detail-email-sender').innerText = escapeHtml(email.sender_name || email.sender);
    document.getElementById('detail-email-receiver').innerText = escapeHtml(getEmployeeDisplayName(email.receiver));
    document.getElementById('detail-email-time').innerText = formatWIBDateTime(email.created_at);
    document.getElementById('detail-email-subject').innerText = escapeHtml(email.subject);
    document.getElementById('detail-email-message').innerText = escapeHtml(email.message);

    var btnReply = document.getElementById('btn-reply-email');
    if (email.sender === Store.get('activeEmployeeSession').id) btnReply.classList.add('hidden');
    else btnReply.classList.remove('hidden');

    document.getElementById('email-detail-modal').classList.remove('hidden');
}

function closeEmailDetailModal() {
    document.getElementById('email-detail-modal').classList.add('hidden');
    Store.set('activeSelectedEmail', null);
}

function replyEmail() {
    var activeSelectedEmail = Store.get('activeSelectedEmail');
    if (!activeSelectedEmail) return;

    var targetSender = activeSelectedEmail.sender;
    var subjectReply = 'Re: ' + activeSelectedEmail.subject;
    closeEmailDetailModal();

    if (document.getElementById('view-desktop').classList.contains('hidden')) {
        switchMobileTab('email');
        switchMobileEmailSub('compose');
        document.getElementById('m-email-recipient').value = targetSender;
        document.getElementById('m-email-subject').value = subjectReply;
        document.getElementById('m-email-message').value = '\n\n--- Pesan Dibalas ---\n' + activeSelectedEmail.message;
    } else {
        switchDesktopTab('email');
        switchDesktopEmailSub('compose');
        document.getElementById('d-email-recipient').value = targetSender;
        document.getElementById('d-email-subject').value = subjectReply;
        document.getElementById('d-email-message').value = '\n\n--- Pesan Dibalas ---\n' + activeSelectedEmail.message;
    }
}

async function deleteEmailItem(emailId) {
    showConfirm('Hapus Pesan', 'Apakah Anda yakin ingin menghapus pesan ini?', async function() {
        await supabaseClient.from('emails').delete().eq('id', emailId);
        var emailsList = Store.get('emailsList');
        Store.set('emailsList', emailsList.filter(function(e) { return e.id !== emailId; }));
        renderEmails();
        updateEmailBadges();
        showToast('Pesan berhasil dihapus.', 'success');
    });
}
'''

with open('/mnt/agents/output/email.js', 'w', encoding='utf-8') as f:
    f.write(email_js)
