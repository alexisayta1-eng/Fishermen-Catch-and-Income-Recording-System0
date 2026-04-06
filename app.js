// Replace these with your actual Supabase Project URL and Anon Key
const SUPABASE_URL = 'https://bilodiwovrpbspbozqfb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpbG9kaXdvdnJicHNwYm96cWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTUwMDgsImV4cCI6MjA5MTAzMTAwOH0.L35OE6jfvZhrLjg7viuVyXgzkV0plI53_XKwcMoNvXo';
const _supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const App = {
    // Current User Session
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,

    async init() {
        console.log("FCIRS Initialized with Supabase Backend");
        if (!_supabase) {
            console.error("Supabase SDK not loaded!");
        }
    },

    async checkConnection() {
        if (!_supabase) {
            console.error("Supabase client not initialized!");
            return false;
        }
        try {
            const { data, error } = await _supabase.from('settings').select('id').limit(1);
            if (error) {
                console.error("Supabase connection error:", error.message);
                return false;
            }
            return true;
        } catch (e) {
            console.error("Supabase connection failure:", e);
            return false;
        }
    },

    async login(username, password) {
        // Fallback for emergency access
        if (username.toLowerCase() === 'admin' && password === '1234') {
            const adminUser = { username: 'Admin', password: '1234', role: 'Admin' };
            this.currentUser = adminUser;
            localStorage.setItem('currentUser', JSON.stringify(adminUser));
            this.redirectBasedOnRole('Admin');
            return true;
        }

        try {
            const { data, error } = await _supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (data && !error) {
                this.currentUser = data;
                localStorage.setItem('currentUser', JSON.stringify(data));
                this.redirectBasedOnRole(data.role);
                return true;
            }
        } catch (error) {
            console.error("Login error:", error);
        }
        return false;
    },

    async register(username, password, role = 'FISHERMAN') {
        try {
            const { data, error } = await _supabase
                .from('users')
                .insert([{ username, password, role }]);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message || 'Registration failed' };
        }
    },

    async deleteUser(username) {
        try {
            const { error: userErr } = await _supabase.from('users').delete().eq('username', username);
            if (userErr) throw userErr;
            
            // Cleanup related data
            await _supabase.from('catches').delete().eq('fisherman', username);
            await _supabase.from('operational_expenses').delete().eq('recorded_by', username);
            
            return { success: true };
        } catch (error) {
            return { success: false };
        }
    },

    logout() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        window.location.href = 'index.html';
    },

    redirectBasedOnRole(role) {
        if (role === 'Admin' || role === 'ADMIN') {
            window.location.href = 'admin.html';
        } else if (role === 'FISHERMAN') {
            window.location.href = 'fisherman.html';
        }
    },

    async getSettings() {
        try {
            const { data, error } = await _supabase
                .from('settings')
                .select('*')
                .order('id', { ascending: false })
                .limit(1)
                .single();
            
            if (data && !error) return data;
            throw error;
        } catch (error) {
            return { prices: { 'Tuna': 150, 'lumayagan': 150, 'Big Karaw': 150, 'Perit': 150, 'Tulingan': 150, 'MC': 150 } };
        }
    },

    async updateSettings(newPrices) {
        let currentSettings = await this.getSettings();
        let updatedPrices;
        
        if (typeof newPrices === 'object') {
            updatedPrices = { ...currentSettings.prices, ...newPrices };
        } else {
            const price = parseFloat(newPrices);
            updatedPrices = {};
            Object.keys(currentSettings.prices).forEach(key => {
                updatedPrices[key] = price;
            });
        }
        
        try {
            // Check if settings exist (id=1 usually)
            const { data: existing } = await _supabase.from('settings').select('id').limit(1).single();
            
            if (existing) {
                await _supabase.from('settings').update({ prices: updatedPrices }).eq('id', existing.id);
            } else {
                await _supabase.from('settings').insert([{ prices: updatedPrices }]);
            }
        } catch (error) {
            console.error("Update settings error:", error);
        }
        return { prices: updatedPrices };
    },

    async getPriceForType(fishType) {
        const settings = await this.getSettings();
        return settings.prices[fishType] || 150;
    },

    async recordCatch(fishType, weight) {
        if (!this.currentUser || this.currentUser.role !== 'FISHERMAN') return;

        const price = await this.getPriceForType(fishType);
        const weightValue = parseFloat(weight);
        const grossValue = weightValue * price;

        try {
            const { data, error } = await _supabase
                .from('catches')
                .insert([{
                    fisherman: this.currentUser.username,
                    fish_type: fishType,
                    weight: weightValue,
                    price_per_kg: price,
                    total_value: grossValue,
                    status: 'RECORDED'
                }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error(error);
        }
    },

    async getFishermanReports() {
        if (!this.currentUser) return [];
        try {
            const { data, error } = await _supabase
                .from('catches')
                .select('*')
                .eq('fisherman', this.currentUser.username);
            
            if (error) throw error;
            return data.map(r => ({
                id: r.id, fisherman: r.fisherman, fishType: r.fish_type, 
                weight: r.weight, pricePerKg: r.price_per_kg, totalValue: r.total_value, 
                recordedAt: r.recorded_at, status: r.status 
            }));
        } catch (error) {
            return [];
        }
    },

    async getFishermen() {
        try {
            const { data, error } = await _supabase
                .from('users')
                .select('*')
                .eq('role', 'FISHERMAN');
            
            if (error) throw error;
            return data;
        } catch (error) {
            return [];
        }
    },

    async getAllSalesData(filterFisherman = null, filterDate = null) {
        try {
            let query = _supabase.from('catches').select('*');
            
            if (filterFisherman) query = query.eq('fisherman', filterFisherman);
            if (filterDate) {
                // Formatting date to match ISO or YYYY-MM-DD
                query = query.gte('recorded_at', `${filterDate}T00:00:00`)
                             .lte('recorded_at', `${filterDate}T23:59:59`);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            return data.map(r => ({
                id: r.id, fisherman: r.fisherman, fishType: r.fish_type, 
                weight: r.weight, pricePerKg: r.price_per_kg, totalValue: r.total_value, 
                recordedAt: r.recorded_at, status: r.status 
            }));
        } catch (error) {
            return [];
        }
    },

    async updateCatch(id, updatedData) {
        try {
            const { error } = await _supabase
                .from('catches')
                .update({
                    weight: updatedData.weight,
                    price_per_kg: updatedData.pricePerKg,
                    total_value: updatedData.weight * updatedData.pricePerKg
                })
                .eq('id', id);
            
            return !error;
        } catch (error) {
            return false;
        }
    },

    async deleteCatch(id) {
        try {
            const { error } = await _supabase.from('catches').delete().eq('id', id);
            return !error;
        } catch (error) {
            return false;
        }
    },

    async manualRecordEntry(fishermanName, fishType, weight, price) {
        const weightValue = parseFloat(weight);
        const priceValue = parseFloat(price || await this.getPriceForType(fishType));
        const grossValue = weightValue * priceValue;

        try {
            const { error } = await _supabase
                .from('catches')
                .insert([{
                    fisherman: fishermanName,
                    fish_type: fishType,
                    weight: weightValue,
                    price_per_kg: priceValue,
                    total_value: grossValue,
                    status: 'SOLD'
                }]);
            
            if (!error) return { success: true };
            throw error;
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async getSummaryStats(filterFisherman = null, filterDate = null) {
        const catches = await this.getAllSalesData(filterFisherman, filterDate);
        const totalWeight = catches.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0);
        const totalGross = catches.reduce((sum, c) => sum + parseFloat(c.totalValue || 0), 0);

        const marketFee = totalGross * 0.20;
        const sharedData = await this.getSharedExpenseData(filterFisherman, filterDate);

        const sharedDeduction = filterFisherman
            ? parseFloat(sharedData.fishermanShare || 0)
            : parseFloat(sharedData.totalMarketExpenses || 0);

        const netSales = totalGross - marketFee;
        const adminShareTersia = netSales * (2 / 3);
        const fishermanShareGross = netSales / 3;
        const fishermanShareTersia = fishermanShareGross - sharedDeduction;

        const totalRevenue = filterFisherman
            ? fishermanShareTersia
            : (netSales - sharedDeduction);

        return {
            totalWeight: totalWeight.toFixed(2),
            totalGross: totalGross.toLocaleString(),
            marketFee: marketFee.toLocaleString(),
            sharedDeduction: sharedDeduction.toLocaleString(),
            netBeforeTersia: netSales.toLocaleString(),
            adminShareTersia: adminShareTersia.toLocaleString(),
            fishermanShareTersia: fishermanShareTersia.toLocaleString(),
            totalRevenue: totalRevenue.toLocaleString(),
            count: catches.length
        };
    },

    async getOperationalExpenses(filterUser = null, filterDate = null) {
        try {
            let query = _supabase.from('operational_expenses').select('*');
            
            if (filterUser) query = query.eq('recorded_by', filterUser);
            if (filterDate) {
                query = query.gte('recorded_at', `${filterDate}T00:00:00`)
                             .lte('recorded_at', `${filterDate}T23:59:59`);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            return data.map(e => ({
                id: e.id, description: e.description, amount: e.amount, 
                category: e.category, recordedBy: e.recorded_by, 
                role: e.role, recordedAt: e.recorded_at
            }));
        } catch (error) {
            return [];
        }
    },

    async getSharedExpenseData(filterFisherman = null, filterDate = null) {
        const allCatches = await this.getAllSalesData(null, filterDate);
        const allExpenses = await this.getOperationalExpenses(null, filterDate);

        const marketExpenses = allExpenses.filter(e => e.category === 'Market Operation');
        const totalMarketExpenses = marketExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

        const activeFishermen = [...new Set(allCatches.map(c => c.fisherman))];
        const activeCount = activeFishermen.length;

        let fishermanShare = 0;
        if (filterFisherman) {
            fishermanShare = marketExpenses
                .filter(e => e.description === filterFisherman)
                .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        }

        return {
            totalMarketExpenses,
            activeCount,
            fishermanShare: parseFloat(fishermanShare || 0).toFixed(2),
            totalMarketWeight: allCatches.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0),
            expensePerKg: (totalMarketExpenses / (allCatches.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0) || 1)).toFixed(2)
        };
    },

    async addOperationalExpense(description, amount, category = 'General') {
        if (!this.currentUser) return { success: false, message: 'Not logged in' };

        try {
            const { error } = await _supabase
                .from('operational_expenses')
                .insert([{
                    description,
                    amount: parseFloat(amount),
                    category,
                    recorded_by: this.currentUser.username,
                    role: this.currentUser.role
                }]);
            
            if (!error) return { success: true };
            throw error;
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async deleteOperationalExpense(id) {
        try {
            const { error } = await _supabase.from('operational_expenses').delete().eq('id', id);
            return !error;
        } catch (error) {
            return false;
        }
    },

    // Real-time synchronization
    subscribeToChanges(callback) {
        if (!_supabase) return;

        _supabase
            .channel('fcirs-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'catches' },
                () => callback()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'operational_expenses' },
                () => callback()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'settings' },
                () => callback()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                () => callback()
            )
            .subscribe();
    },

    resetSystem() {
        alert("System reset is disabled in production database mode.");
    }
};

App.init();
