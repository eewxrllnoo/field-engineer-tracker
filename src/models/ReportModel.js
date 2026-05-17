import { CONFIG } from '../config/config.js';

export class ReportModel {
    constructor() {
        this.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        this.user = null;
        this.currentReportId = null;
    }

    async getSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        this.user = session?.user || null;
        return this.user;
    }

    async login(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.user = data.user;
        return data.user;
    }

    async register(email, password, name) {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
        });
        if (error) throw error;
        return data;
    }

    async logout() {
        await this.supabase.auth.signOut();
        this.user = null;
    }

    async saveReport(reportData, id = null) {
        if (!this.user) throw new Error('Authentication required to save reports');
        if (id) {
            const { data, error } = await this.supabase.from('fso_reports').update(reportData).eq('id', id);
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await this.supabase.from('fso_reports').insert([{ ...reportData, user_id: this.user.id }]);
            if (error) throw error;
            return data;
        }
    }

    async fetchReports(limit = null) {
        if (!this.user) return [];
        let query = this.supabase.from('fso_reports').select('*').eq('user_id', this.user.id).order('created_at', { ascending: false });
        if (limit) query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async getReportById(id) {
        const { data, error } = await this.supabase.from('fso_reports').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    }

    async deleteReport(id) {
        const { error } = await this.supabase.from('fso_reports').delete().eq('id', id);
        if (error) throw error;
    }

    saveLocal(data) {
        if (!this.user) return;
        localStorage.setItem(`fe_track_${this.user.id}`, JSON.stringify(data));
    }

    loadLocal() {
        if (!this.user) return null;
        const data = localStorage.getItem(`fe_track_${this.user.id}`);
        return data ? JSON.parse(data) : null;
    }
}
