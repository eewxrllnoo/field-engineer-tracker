export class ReportController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.isEditMode = false;
        this.currentEditId = null;

        this.init();
    }

    async init() {
        this.registerEvents();

        // Reactive auth state listener
        this.model.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event);
            if (event === 'SIGNED_OUT') {
                this.model.user = null;
                this.view.showAuth();
                this.isEditMode = false;
                this.currentEditId = null;
            } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                if (session?.user) {
                    this.model.user = session.user;
                    // Only handle login if we are currently showing auth
                    const appContainer = this.view.getElement(this.view.selectors.appContainer);
                    if (appContainer && appContainer.classList.contains('hidden')) {
                        this.handleLogin(session.user);
                    }
                }
            }
        });
    }

    registerEvents() {
        const safeOnclick = (selector, handler) => {
            const el = this.view.getElement(selector);
            if (el) el.onclick = handler;
        };

        const safeOnsubmit = (selector, handler) => {
            const el = this.view.getElement(selector);
            if (el) el.onsubmit = handler;
        };

        // Auth Tabs
        document.querySelectorAll(this.view.selectors.authTabs).forEach(tab => {
            tab.onclick = () => this.view.toggleAuthTab(tab.dataset.tab);
        });

        // Login
        safeOnsubmit(this.view.selectors.loginForm, async (e) => {
            e.preventDefault();
            const email = e.target.email.value;
            const password = e.target.password.value;
            try {
                const user = await this.model.login(email, password);
                this.handleLogin(user);
            } catch (err) { this.view.showToast(err.message, 'error'); }
        });

        // Register
        safeOnsubmit(this.view.selectors.registerForm, async (e) => {
            e.preventDefault();
            const { name, email, password, confirm } = e.target;
            if (password.value !== confirm.value) return this.view.showToast('Passwords do not match', 'error');
            try {
                await this.model.register(email.value, password.value, name.value);
                this.view.showToast('Check email for confirmation');
                this.view.toggleAuthTab('login');
            } catch (err) { this.view.showToast(err.message, 'error'); }
        });

        // UI Buttons
        const logoutBtn = this.view.getElement('#btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    try {
                        console.log('Attempting Supabase sign out...');
                        await this.model.logout();
                        console.log('Sign out successful. Redirecting...');
                        // Force a clean reload to the origin to clear any state
                        window.location.replace(window.location.origin);
                    } catch (err) {
                        console.error('Logout error:', err);
                        this.view.showToast('Logout failed: ' + err.message, 'error');
                        // Attempt to reload anyway to clear local state if possible
                        window.location.reload(); 
                    }
                }
            });
        }

        safeOnclick('#btn-add-row', () => this.view.addExpenseRow(null, () => this.view.updateGrandTotal()));
        safeOnclick('#btn-save', () => this.saveReport());
        safeOnclick('#btn-update-report', () => this.saveReport(true));
        safeOnclick('#btn-cancel-edit', () => this.exitEditMode());
        safeOnclick('#btn-reset', () => confirm('Reset?') && this.resetForm());
        safeOnclick('#btn-refresh-recent', () => this.fetchRecent());
        
        safeOnclick('#btn-save-local', () => {
            const data = this.view.getFormData();
            this.model.saveLocal(data);
            this.view.showToast('Saved locally');
        });

        safeOnclick('#btn-load-local', () => {
            const data = this.model.loadLocal();
            if (data) this.view.fillForm(data);
            else this.view.showToast('No local data', 'error');
        });

        safeOnclick('#btn-view-all', async () => {
            const reports = await this.model.fetchReports();
            this.view.renderAllReports(reports, (id) => {
                this.loadReport(id);
                const modal = this.view.getElement('#reports-modal');
                if (modal) modal.style.display = 'none';
            });
        });

        safeOnclick('#btn-close-modal', () => {
            const modal = this.view.getElement('#reports-modal');
            if (modal) modal.style.display = 'none';
        });

        safeOnclick('#btn-export', () => this.exportExcel());
    }

    handleLogin(user) {
        this.view.showApp(user);
        this.view.addExpenseRow(null, () => this.view.updateGrandTotal());
        this.fetchRecent();
    }

    async fetchRecent() {
        try {
            const reports = await this.model.fetchReports(5);
            this.view.renderRecentReports(reports, {
                onLoad: (id) => this.loadReport(id),
                onEdit: (id) => this.enterEditMode(id),
                onDelete: (id) => this.deleteReport(id)
            });
        } catch (err) { console.error(err); }
    }

    async saveReport(isUpdate = false) {
        const formData = this.view.getFormData();
        if (!formData.isValid) return this.view.showToast('Missing required fields or project name', 'error');

        const reportData = {
            engineer_name: formData.engineer_name,
            coverage_start: formData.coverage_start,
            coverage_end: formData.coverage_end,
            cluster: formData.cluster,
            date_filed: formData.date_filed,
            team_lead: formData.team_lead,
            expenses: formData.expenses,
            totals: { grand: parseFloat(this.view.updateGrandTotal()) }
        };

        try {
            await this.model.saveReport(reportData, isUpdate ? this.currentEditId : null);
            this.view.showToast(isUpdate ? 'Report updated' : 'Report saved');
            if (isUpdate) this.exitEditMode();
            else this.resetForm();
            this.fetchRecent();
        } catch (err) { this.view.showToast(err.message, 'error'); }
    }

    async loadReport(id) {
        try {
            const report = await this.model.getReportById(id);
            this.view.fillForm(report);
            this.view.showToast('Report loaded');
        } catch (err) { this.view.showToast(err.message, 'error'); }
    }

    enterEditMode(id) {
        this.loadReport(id);
        this.isEditMode = true;
        this.currentEditId = id;
        this.view.setEditMode(true, id);
    }

    exitEditMode() {
        this.isEditMode = false;
        this.currentEditId = null;
        this.view.setEditMode(false);
    }

    async deleteReport(id) {
        if (confirm('Delete?')) {
            try {
                await this.model.deleteReport(id);
                this.view.showToast('Deleted');
                this.fetchRecent();
                if (this.currentEditId === id) this.exitEditMode();
            } catch (err) { this.view.showToast(err.message, 'error'); }
        }
    }

    resetForm() {
        this.view.fillForm({});
        this.exitEditMode();
        this.view.addExpenseRow(null, () => this.view.updateGrandTotal());
    }

    async exportExcel() {
        const formData = this.view.getFormData();
        const wb = new ExcelJS.Workbook();
        const mainTitle = 'BASED ALLOWANCE REPLENISHMENT (FSO)';
        
        // Header styling
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F4F4F' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        const dataStyle = {
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // --- FSO SHEET ---
        const s1 = wb.addWorksheet('FSO');
        
        s1.mergeCells('A1:P1');
        s1.getCell('A1').value = mainTitle;
        s1.getCell('A1').font = { bold: true, size: 14 };

        // Meta info
        s1.getCell('A3').value = 'Field Engineer:'; s1.getCell('B3').value = formData.engineer_name;
        s1.getCell('I3').value = 'Date Coverage:'; s1.getCell('J3').value = `${formData.coverage_start} to ${formData.coverage_end}`;
        s1.getCell('A4').value = 'Cluster:'; s1.getCell('B4').value = formData.cluster;
        s1.getCell('I4').value = 'Date Filed:'; s1.getCell('J4').value = formData.date_filed;
        s1.getCell('A5').value = 'Team Lead:'; s1.getCell('B5').value = formData.team_lead;
        
        ['A3', 'I3', 'A4', 'I4', 'A5'].forEach(cell => s1.getCell(cell).font = { bold: true });

        const fsoHeaders = [
            'Activity Date', 'FP ticket', 'Project Name', 'Purchase Order (PO#)', 
            'Launch Point', 'Client Address / Onsite Address', 'Distance (KM)', 
            'Transpo', 'Meal', 'Lodging', 'Materials', 'Print', 
            'Freight', 'Rental', 'Others', 'Total'
        ];
        
        fsoHeaders.forEach((h, i) => {
            const cell = s1.getCell(7, i + 1);
            cell.value = h;
            cell.style = headerStyle;
            s1.getColumn(i + 1).width = i === 5 ? 45 : (i === 2 ? 30 : 15);
        });

        formData.expenses.forEach((ex, idx) => {
            const rowNum = 8 + idx;
            const values = [
                ex.date, ex.ticket, ex.project, ex.po, ex.launch, ex.address, ex.dist,
                ex.transpo, ex.meal, ex.lodging, ex.materials, ex.print,
                ex.freight, ex.rental, ex.others, ex.total
            ];
            values.forEach((v, vIdx) => {
                const cell = s1.getCell(rowNum, vIdx + 1);
                cell.value = v;
                cell.style = dataStyle;
            });
        });

        // --- SUMMARY SHEET ---
        const s2 = wb.addWorksheet('Summary');
        
        s2.mergeCells('A1:K1');
        s2.getCell('A1').value = mainTitle;
        s2.getCell('A1').font = { bold: true, size: 14 };

        s2.getCell('A3').value = 'Field Engineers Name:'; s2.getCell('B3').value = formData.engineer_name;
        s2.getCell('G3').value = 'Date Coverag:'; s2.getCell('H3').value = `${formData.coverage_start} to ${formData.coverage_end}`;
        s2.getCell('A4').value = 'Cluster:'; s2.getCell('B4').value = formData.cluster;
        s2.getCell('G4').value = 'Date Filed:'; s2.getCell('H4').value = formData.date_filed;
        s2.getCell('A5').value = 'Team Lead:'; s2.getCell('B5').value = formData.team_lead;
        
        ['A3', 'G3', 'A4', 'G4', 'A5'].forEach(cell => s2.getCell(cell).font = { bold: true });

        s2.getCell('A7').value = 'SUMMARY';
        s2.getCell('A7').font = { bold: true };

        const summaryHeaders = [
            'Project Name', 'Purchase Order (PO#)', 'Transpo', 'Meal', 'Lodging', 
            'Materials', 'Print', 'Freight', 'Rental', 'Others', 'Total'
        ];
        
        summaryHeaders.forEach((h, i) => {
            const cell = s2.getCell(9, i + 1);
            cell.value = h;
            cell.style = headerStyle;
            s2.getColumn(i + 1).width = i === 0 ? 35 : 15;
        });

        const summaryData = {};
        formData.expenses.forEach(ex => {
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

        let currentSumRow = 10;
        let grandTotals = { tr: 0, m: 0, l: 0, mat: 0, pr: 0, fr: 0, ren: 0, o: 0, t: 0 };
        
        Object.values(summaryData).forEach(v => {
            const values = [v.p, v.po, v.tr, v.m, v.l, v.mat, v.pr, v.fr, v.ren, v.o, v.t];
            values.forEach((val, i) => {
                const cell = s2.getCell(currentSumRow, i + 1);
                cell.value = val;
                cell.style = dataStyle;
            });
            
            grandTotals.tr += v.tr;
            grandTotals.m += v.m;
            grandTotals.l += v.l;
            grandTotals.mat += v.mat;
            grandTotals.pr += v.pr;
            grandTotals.fr += v.fr;
            grandTotals.ren += v.ren;
            grandTotals.o += v.o;
            grandTotals.t += v.t;
            
            currentSumRow++;
        });

        // Grand Total row
        const grandTotalLabelCell = s2.getCell(currentSumRow, 1);
        grandTotalLabelCell.value = 'Grand Total';
        grandTotalLabelCell.font = { bold: true };
        grandTotalLabelCell.style = dataStyle;
        s2.getCell(currentSumRow, 2).style = dataStyle;

        const gValues = [
            grandTotals.tr, grandTotals.m, grandTotals.l, grandTotals.mat, 
            grandTotals.pr, grandTotals.fr, grandTotals.ren, grandTotals.o, grandTotals.t
        ];
        gValues.forEach((val, i) => {
            const cell = s2.getCell(currentSumRow, i + 3);
            cell.value = val;
            cell.font = { bold: true };
            cell.style = dataStyle;
        });

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FE_Report_${formData.engineer_name}_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        this.view.showToast('Excel Exported Successfully');
    }
}
