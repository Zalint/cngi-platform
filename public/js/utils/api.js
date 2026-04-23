// Client API pour communiquer avec le backend

const API = {
    baseURL: '/api',

    /**
     * Faire une requête HTTP
     * @param {string} endpoint - Endpoint de l'API
     * @param {object} options - Options fetch
     * @returns {Promise}
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        // Ajouter le token JWT si disponible
        const token = Auth.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // Si 401, déconnecter l'utilisateur
                if (response.status === 401) {
                    Auth.logout();
                    window.location.hash = '#/login';
                }
                throw new Error(data.message || 'Erreur API');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    /**
     * GET request
     */
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    /**
     * POST request
     */
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * PUT request
     */
    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    /**
     * PATCH request
     */
    patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    /**
     * DELETE request
     */
    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // === Auth endpoints ===
    auth: {
        login: (credentials) => API.post('/auth/login', credentials),
        logout: () => API.post('/auth/logout', {}),
        getMe: () => API.get('/auth/me'),
        changePassword: (data) => API.post('/auth/change-password', data)
    },

    // === Users endpoints ===
    users: {
        getAll: () => API.get('/users'),
        getById: (id) => API.get(`/users/${id}`),
        create: (data) => API.post('/users', data),
        update: (id, data) => API.put(`/users/${id}`, data),
        delete: (id) => API.delete(`/users/${id}`),
        getByStructure: (structureId) => API.get(`/users/structure/${structureId}`)
    },

    // === Structures endpoints ===
    structures: {
        getAll: () => API.get('/structures'),
        getById: (id) => API.get(`/structures/${id}`),
        create: (data) => API.post('/structures', data),
        update: (id, data) => API.put(`/structures/${id}`, data),
        delete: (id) => API.delete(`/structures/${id}`),
        getStats: () => API.get('/structures/stats')
    },

    // === Projects endpoints ===
    projects: {
        getAll: (filters) => {
            const params = new URLSearchParams(filters).toString();
            return API.get(`/projects${params ? '?' + params : ''}`);
        },
        getById: (id) => API.get(`/projects/${id}`),
        create: (data) => API.post('/projects', data),
        update: (id, data) => API.put(`/projects/${id}`, data),
        updateProgress: (id, progress) => API.patch(`/projects/${id}/progress`, { progress_percentage: progress }),
        delete: (id) => API.delete(`/projects/${id}`),
        addLocality: (id, data) => API.post(`/projects/${id}/localities`, data),
        addSite: (id, data) => API.post(`/projects/${id}/sites`, data),
        addMeasure: (id, data) => API.post(`/projects/${id}/measures`, data),
        addStakeholder: (id, data) => API.post(`/projects/${id}/stakeholders`, data),
        addFinancing: (id, data) => API.post(`/projects/${id}/financing`, data),
        getStats: (structureId) => API.get(`/projects/stats${structureId ? '?structure_id=' + structureId : ''}`),
        // Project-Structure Mappings
        getProjectStructures: (id) => API.get(`/projects/${id}/structures`),
        assignProjectStructures: (id, structureIds) => API.post(`/projects/${id}/structures`, { structure_ids: structureIds }),
        removeProjectStructure: (id, structureId) => API.delete(`/projects/${id}/structures/${structureId}`),
        getAllProjectMappings: () => API.get('/projects/mappings/all'),
        // Measure Assignments
        assignUserToMeasure: (projectId, measureId, userId) => API.put(`/projects/${projectId}/measures/${measureId}/assign`, { userId }),
        reassignMeasure: (projectId, measureId, data) => API.put(`/projects/${projectId}/measures/${measureId}/reassign`, data),
        updateMeasureStatus: (projectId, measureId, status, constraints) => API.put(`/projects/${projectId}/measures/${measureId}/status`, { status, constraints }),
        // Project Comments
        getComments: (id) => API.get(`/projects/${id}/comments`),
        addComment: (id, comment) => API.post(`/projects/${id}/comments`, { comment }),
        deleteComment: (id, commentId) => API.delete(`/projects/${id}/comments/${commentId}`),
        // Geometries (tracés)
        listGeometries: (projectId) => API.get(`/projects/${projectId}/geometries`),
        createGeometry: (projectId, data) => API.post(`/projects/${projectId}/geometries`, data),
        importGeometries: (projectId, geojson) => API.post(`/projects/${projectId}/geometries/import`, geojson),
        updateGeometry: (projectId, geomId, data) => API.put(`/projects/${projectId}/geometries/${geomId}`, data),
        deleteGeometry: (projectId, geomId) => API.delete(`/projects/${projectId}/geometries/${geomId}`)
    },

    // === Forms endpoints ===
    forms: {
        getAll: () => API.get('/forms'),
        getById: (id) => API.get(`/forms/${id}`),
        create: (data) => API.post('/forms', data),
        update: (id, data) => API.put(`/forms/${id}`, data),
        delete: (id) => API.delete(`/forms/${id}`),
        getSubmissions: (id) => API.get(`/forms/${id}/submissions`)
    },

    // === Submissions endpoints ===
    submissions: {
        submit: (data) => API.post('/submissions', data),
        getById: (id) => API.get(`/submissions/${id}`)
    },

    // === Measure Comments endpoints ===
    measureComments: {
        create: (measureId, comment) => API.post(`/measures/${measureId}/comments`, { comment }),
        getByMeasure: (measureId) => API.get(`/measures/${measureId}/comments`),
        delete: (commentId) => API.delete(`/comments/${commentId}`)
    },

    // === Dashboard endpoints ===
    dashboard: {
        getMetrics: (structureId) => API.get(`/dashboard/metrics${structureId ? '?structure_id=' + structureId : ''}`),
        getProjectsByStructure: () => API.get('/dashboard/projects-by-structure'),
        getMapData: (structureId) => API.get(`/dashboard/map-data${structureId ? '?structure_id=' + structureId : ''}`),
        getMapGeometries: () => API.get('/dashboard/map-geometries'),
        getRecentProjects: (limit) => API.get(`/dashboard/recent-projects?limit=${limit || 10}`),
        getLateProjects: (structureId) => API.get(`/dashboard/late-projects${structureId ? '?structure_id=' + structureId : ''}`),
        getChartData: (structureId) => API.get(`/dashboard/chart-data${structureId ? '?structure_id=' + structureId : ''}`)
    },

    // === Observations endpoints ===
    observations: {
        list: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return API.get(`/observations${params ? '?' + params : ''}`);
        },
        getById: (id) => API.get(`/observations/${id}`),
        create: (data) => API.post('/observations', data),
        update: (id, data) => API.put(`/observations/${id}`, data),
        delete: (id) => API.delete(`/observations/${id}`),
        getUnreadCount: () => API.get('/observations/unread-count'),
        markRead: () => API.post('/observations/mark-read')
    },

    // === PV (Commandement territorial) endpoints ===
    pv: {
        list: () => API.get('/pv'),
        getPickable: () => API.get('/pv/pickable'),
        getById: (id) => API.get(`/pv/${id}`),
        create: (data) => API.post('/pv', data),
        update: (id, data) => API.put(`/pv/${id}`, data),
        delete: (id) => API.delete(`/pv/${id}`),
        getUnreadCount: () => API.get('/pv/unread-count'),
        markAllRead: () => API.post('/pv/mark-read'),
        markOneRead: (id) => API.post(`/pv/${id}/mark-read`)
    },

    // === API Keys endpoints ===
    apiKeys: {
        list: () => API.get('/api-keys'),
        create: (data) => API.post('/api-keys', data),
        revoke: (id) => API.post(`/api-keys/${id}/revoke`),
        delete: (id) => API.delete(`/api-keys/${id}`)
    },

    // === Config endpoints ===
    config: {
        getByCategory: (category) => API.get(`/config/${category}`),
        getAll: () => API.get('/config'),
        create: (data) => API.post('/config', data),
        update: (id, data) => API.put(`/config/${id}`, data),
        delete: (id) => API.delete(`/config/${id}`)
    },

    // === Uploads endpoints ===
    uploads: {
        upload: async (file, entityType, entityId, label = null) => {
            const formData = new FormData();
            formData.append('file', file);
            if (entityType) formData.append('entity_type', entityType);
            if (entityId) formData.append('entity_id', entityId);
            if (label) formData.append('label', label);

            const token = Auth.getToken();
            const response = await fetch(`${API.baseURL}/uploads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            return await response.json();
        },
        getById: (id) => API.get(`/uploads/${id}`),
        getByEntity: (entityType, entityId) => API.get(`/uploads?entity_type=${entityType}&entity_id=${entityId}`),
        delete: (id) => API.delete(`/uploads/${id}`)
    },

    // === Decoupage administratif endpoints ===
    decoupage: {
        getAllByLevel: (level) => API.get(`/decoupage/level/${level}`),
        search: (q) => API.get(`/decoupage/search?q=${encodeURIComponent(q)}`),
        getRegions: () => API.get('/decoupage/regions'),
        getDepartements: (region) => API.get(`/decoupage/departements?region=${encodeURIComponent(region)}`),
        getArrondissements: (departement) => API.get(`/decoupage/arrondissements?departement=${encodeURIComponent(departement)}`),
        getCommunes: (arrondissement) => API.get(`/decoupage/communes?arrondissement=${encodeURIComponent(arrondissement)}`),
        getAll: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.get(`/decoupage${query ? '?' + query : ''}`);
        },
        getStats: () => API.get('/decoupage/stats'),
        reverseGeocode: (lat, lon) => API.get(`/decoupage/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`),
        forwardGeocode: (q) => API.get(`/decoupage/forward?q=${encodeURIComponent(q)}`),
        create: (data) => API.post('/decoupage', data),
        update: (id, data) => API.put(`/decoupage/${id}`, data),
        delete: (id) => API.delete(`/decoupage/${id}`)
    },

    // === Seed endpoints (Admin only) ===
    seed: {
        reset: () => API.post('/seed/reset', {}),
        populate: () => API.post('/seed/populate', {}),
        resetAndPopulate: () => API.post('/seed/reset-and-populate', {})
    }
};

