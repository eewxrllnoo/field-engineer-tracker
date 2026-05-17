export class ReportView {
    constructor() {
        this.selectors = {
            authContainer: '#auth-container',
            appContainer: '#app-container',
            loginForm: '#login-form',
            registerForm: '#register-form',
            authTabs: '.auth-tab',
            userName: '#display-user-name',
            expenseTbody: '#expense-tbody',
            grandTotal: '#grand-total',
            recentReports: '#recent-reports-list',
            editIndicator: '#edit-indicator-bar',
            summarySection: '#summary-section',
            summaryTbody: '#summary-tbody',
            btnSave: '#btn-save',
            btnUpdate: '#btn-update-report',
            btnCancelEdit: '#btn-cancel-edit',
            modal: '#reports-modal',
            modalBody: '#modal-reports-body',
            inputs: {
                engineer: '#field-engineer',
                start: '#coverage-start',
                end: '#coverage-end',
                cluster: '#cluster',
                filed: '#date-filed',
                lead: '#team-lead'
            }
        };

        this.columnKeys = ['date', 'ticket', 'project', 'po', 'launch', 'address', 'dist', 'transpo', 'meal', 'lodging', 'materials', 'print', 'freight', 'rental', 'others'];
    }

    getElement(selector) {
        return document.querySelector(selector);
    }

    showAuth() {
        this.getElement(this.selectors.authContainer).classList.remove('hidden');
        this.getElement(this.selectors.appContainer).classList.add('hidden');
    }

    showApp(user) {
        this.getElement(this.selectors.authContainer).classList.add('hidden');
        this.getElement(this.selectors.appContainer).classList.remove('hidden');
        this.getElement(this.selectors.userName).innerText = user.user_metadata.full_name || user.email;
        this.getElement(this.selectors.inputs.filed).valueAsDate = new Date();
    }

    toggleAuthTab(tabType) {
        const tabs = document.querySelectorAll(this.selectors.authTabs);
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabType));
        this.getElement(this.selectors.loginForm).classList.toggle('hidden', tabType !== 'login');
        this.getElement(this.selectors.registerForm).classList.toggle('hidden', tabType !== 'register');
    }

    addExpenseRow(data = null, onCalc) {
        const tbody = this.getElement(this.selectors.expenseTbody);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="date" class="table-input" value="${data?.date || ''}"></td>
            <td><input type="text" class="table-input" value="${data?.ticket || ''}"></td>
            <td><input type="text" class="table-input" value="${data?.project || ''}"></td>
            <td><input type="text" class="table-input" value="${data?.po || ''}"></td>
            <td><input type="text" class="table-input" value="${data?.launch || ''}"></td>
            <td><input type="text" class="table-input" value="${data?.address || ''}"></td>
            <td><input type="number" step="0.1" class="table-input num" value="${data?.dist || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.transpo || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.meal || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.lodging || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.materials || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.print || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.freight || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.rental || 0}"></td>
            <td><input type="number" step="0.01" class="table-input num" value="${data?.others || 0}"></td>
            <td><span class="row-total">0.00</span></td>
            <td><button class="btn btn-danger btn-sm row-remove-btn"><i class="fas fa-trash"></i></button></td>
        `;

        const calcRow = () => {
            const nums = tr.querySelectorAll('.table-input.num');
            let sum = 0;
            for(let i=1; i<nums.length; i++) sum += parseFloat(nums[i].value) || 0;
            tr.querySelector('.row-total').innerText = sum.toLocaleString('en-US', {minimumFractionDigits: 2});
            onCalc();
        };

        tr.querySelectorAll('.table-input.num').forEach(input => input.addEventListener('input', calcRow));
        tr.querySelectorAll('.table-input').forEach(input => {
            if (!input.classList.contains('num')) {
                input.addEventListener('input', () => this.updateSummary());
            }
        });
        tr.querySelector('.row-remove-btn').addEventListener('click', () => { tr.remove(); onCalc(); });

        tbody.appendChild(tr);
        if(data) calcRow();
    }

    updateGrandTotal() {
        let grand = 0;
        document.querySelectorAll('.row-total').forEach(span => {
            grand += parseFloat(span.innerText.replace(/,/g, '')) || 0;
        });
        this.getElement(this.selectors.grandTotal).innerText = grand.toLocaleString('en-US', {minimumFractionDigits: 2});
        this.updateSummary();
        return grand;
    }

    updateSummary() {
        const formData = this.getFormData();
        const summaryData = {};
        const tbody = this.getElement(this.selectors.summaryTbody);
        const section = this.getElement(this.selectors.summarySection);
        
        tbody.innerHTML = '';
        
        if (formData.expenses.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        formData.expenses.forEach(ex => {
            if (!ex.project) return;
            const k = `${ex.project}|${ex.po}`;
            if (!summaryData[k]) {
                summaryData[k] = { 
                    p: ex.project, po: ex.po, 
                    tr: 0, m: 0, l: 0, mat: 0, pr: 0, fr: 0, ren: 0, o: 0, t: 0 
                };
            }
            summaryData[k].tr += ex.transpo;
            summaryData[k].m += ex.meal;
            summaryData[k].l += ex.lodging;
            summaryData[k].mat += ex.materials;
            summaryData[k].pr += ex.print;
            summaryData[k].fr += ex.freight;
            summaryData[k].ren += ex.rental;
            summaryData[k].o += ex.others;
            summaryData[k].t += ex.total;
        });

        const rows = Object.values(summaryData);
        if (rows.length === 0) {
            section.style.display = 'none';
            return;
        }

        rows.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${v.p}</td>
                <td>${v.po}</td>
                <td>${v.tr.toFixed(2)}</td>
                <td>${v.m.toFixed(2)}</td>
                <td>${v.l.toFixed(2)}</td>
                <td>${v.mat.toFixed(2)}</td>
                <td>${v.pr.toFixed(2)}</td>
                <td>${v.fr.toFixed(2)}</td>
                <td>${v.ren.toFixed(2)}</td>
                <td>${v.o.toFixed(2)}</td>
                <td class="row-total">${v.t.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    getFormData() {
        const formData = {
            engineer_name: this.getElement(this.selectors.inputs.engineer).value,
            coverage_start: this.getElement(this.selectors.inputs.start).value,
            coverage_end: this.getElement(this.selectors.inputs.end).value,
            cluster: this.getElement(this.selectors.inputs.cluster).value,
            date_filed: this.getElement(this.selectors.inputs.filed).value,
            team_lead: this.getElement(this.selectors.inputs.lead).value,
            expenses: []
        };

        let hasProject = false;
        document.querySelectorAll('#expense-tbody tr').forEach(tr => {
            const inputs = tr.querySelectorAll('.table-input');
            const row = {};
            this.columnKeys.forEach((k, i) => {
                row[k] = i >= 6 ? parseFloat(inputs[i].value) || 0 : inputs[i].value;
            });
            row.total = parseFloat(tr.querySelector('.row-total').innerText.replace(/,/g, ''));
            if (row.project) hasProject = true;
            formData.expenses.push(row);
        });

        return { ...formData, isValid: !!(formData.engineer_name && formData.coverage_start && formData.coverage_end && hasProject) };
    }

    fillForm(data) {
        this.getElement(this.selectors.inputs.engineer).value = data.engineer_name || data.eng || '';
        this.getElement(this.selectors.inputs.start).value = data.coverage_start || data.s || '';
        this.getElement(this.selectors.inputs.end).value = data.coverage_end || data.e || '';
        this.getElement(this.selectors.inputs.cluster).value = data.cluster || data.c || '';
        this.getElement(this.selectors.inputs.filed).value = data.date_filed || '';
        this.getElement(this.selectors.inputs.lead).value = data.team_lead || data.l || '';
        
        const tbody = this.getElement(this.selectors.expenseTbody);
        tbody.innerHTML = '';
        (data.expenses || data.ex || []).forEach(e => this.addExpenseRow(e, () => this.updateGrandTotal()));
        this.updateGrandTotal();
    }

    renderRecentReports(reports, handlers) {
        const list = this.getElement(this.selectors.recentReports);
        list.innerHTML = '';
        if (reports.length === 0) {
            list.innerHTML = '<p class="text-center p-4 text-muted" style="width: 100%">No recent reports found.</p>';
            return;
        }

        reports.forEach(r => {
            const card = document.createElement('div');
            card.className = 'report-mini-card';
            card.innerHTML = `
                <div class="flex justify-between mb-2">
                    <strong style="color: var(--primary)">${r.engineer_name}</strong>
                    <span class="text-muted" style="font-size:0.7rem">${new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p style="font-size: 0.75rem; margin-bottom: 0.5rem">
                    <i class="fas fa-calendar"></i> ${r.coverage_start} - ${r.coverage_end}<br>
                    <i class="fas fa-map-marker-alt"></i> ${r.cluster} | <i class="fas fa-user-tie"></i> ${r.team_lead}
                </p>
                <div class="flex justify-between items-center">
                    <span style="font-weight: 700">₱${(r.totals?.grand || 0).toLocaleString()}</span>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-outline load-btn">View</button>
                        <button class="btn btn-sm btn-primary edit-btn">Edit</button>
                        <button class="btn btn-sm btn-danger delete-btn"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            card.querySelector('.load-btn').onclick = () => handlers.onLoad(r.id);
            card.querySelector('.edit-btn').onclick = () => handlers.onEdit(r.id);
            card.querySelector('.delete-btn').onclick = () => handlers.onDelete(r.id);
            list.appendChild(card);
        });
    }

    renderAllReports(reports, onLoad) {
        const body = this.getElement(this.selectors.modalBody);
        body.innerHTML = '';
        reports.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.engineer_name}</td>
                <td>${r.coverage_start} - ${r.coverage_end}</td>
                <td>${r.cluster}</td>
                <td>${r.team_lead}</td>
                <td>₱${(r.totals?.grand || 0).toLocaleString()}</td>
                <td>${r.date_filed}</td>
                <td><button class="btn btn-sm btn-primary load-btn">Load</button></td>
            `;
            tr.querySelector('.load-btn').onclick = () => onLoad(r.id);
            body.appendChild(tr);
        });
        this.getElement(this.selectors.modal).style.display = 'flex';
    }

    setEditMode(active, id = null) {
        this.getElement(this.selectors.editIndicator).classList.toggle('hidden', !active);
        if (id) document.getElementById('editing-report-id').innerText = id;
        this.getElement(this.selectors.btnSave).classList.toggle('hidden', active);
        this.getElement(this.selectors.btnUpdate).style.display = active ? 'inline-flex' : 'none';
        this.getElement(this.selectors.btnCancelEdit).style.display = active ? 'inline-flex' : 'none';
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
}
