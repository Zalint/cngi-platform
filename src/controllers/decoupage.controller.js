const DecoupageModel = require('../models/decoupage.model');

exports.search = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ success: true, data: [] });
        }
        const results = await DecoupageModel.search(q);
        res.json({ success: true, data: results });
    } catch (error) {
        next(error);
    }
};

exports.getRegions = async (req, res, next) => {
    try {
        const regions = await DecoupageModel.getRegions();
        res.json({ success: true, count: regions.length, data: regions });
    } catch (error) {
        next(error);
    }
};

exports.getDepartements = async (req, res, next) => {
    try {
        const { region } = req.query;
        if (!region) {
            return res.status(400).json({ success: false, message: 'Le parametre region est requis' });
        }
        const departements = await DecoupageModel.getDepartements(region);
        res.json({ success: true, count: departements.length, data: departements });
    } catch (error) {
        next(error);
    }
};

exports.getArrondissements = async (req, res, next) => {
    try {
        const { departement } = req.query;
        if (!departement) {
            return res.status(400).json({ success: false, message: 'Le parametre departement est requis' });
        }
        const arrondissements = await DecoupageModel.getArrondissements(departement);
        res.json({ success: true, count: arrondissements.length, data: arrondissements });
    } catch (error) {
        next(error);
    }
};

exports.getCommunes = async (req, res, next) => {
    try {
        const { arrondissement } = req.query;
        if (!arrondissement) {
            return res.status(400).json({ success: false, message: 'Le parametre arrondissement est requis' });
        }
        const communes = await DecoupageModel.getCommunes(arrondissement);
        res.json({ success: true, count: communes.length, data: communes });
    } catch (error) {
        next(error);
    }
};

exports.getAll = async (req, res, next) => {
    try {
        const { region, departement, page, limit } = req.query;
        const result = await DecoupageModel.getAll({ region, departement, page, limit });
        res.json({ success: true, count: result.data.length, pagination: result.pagination, data: result.data });
    } catch (error) {
        next(error);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        const stats = await DecoupageModel.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const { region, departement, arrondissement, commune } = req.body;
        if (!region || !departement || !arrondissement || !commune) {
            return res.status(400).json({ success: false, message: 'Tous les champs sont requis: region, departement, arrondissement, commune' });
        }
        const entry = await DecoupageModel.create(req.body);
        if (!entry) {
            return res.status(409).json({ success: false, message: 'Cette entree existe deja' });
        }
        res.status(201).json({ success: true, message: 'Entree creee avec succes', data: entry });
    } catch (error) {
        next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const entry = await DecoupageModel.update(req.params.id, req.body);
        if (!entry) {
            return res.status(404).json({ success: false, message: 'Entree non trouvee' });
        }
        res.json({ success: true, message: 'Entree mise a jour avec succes', data: entry });
    } catch (error) {
        next(error);
    }
};

exports.delete = async (req, res, next) => {
    try {
        const entry = await DecoupageModel.delete(req.params.id);
        if (!entry) {
            return res.status(404).json({ success: false, message: 'Entree non trouvee' });
        }
        res.json({ success: true, message: 'Entree supprimee avec succes' });
    } catch (error) {
        next(error);
    }
};

exports.bulkImport = async (req, res, next) => {
    try {
        const items = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Un tableau non vide est requis' });
        }

        let created = 0;
        let skipped = 0;
        const errors = [];

        for (let i = 0; i < items.length; i++) {
            const { region, departement, arrondissement, commune } = items[i];
            if (!region || !departement || !arrondissement || !commune) {
                errors.push({ index: i, message: 'Champs manquants' });
                skipped++;
                continue;
            }
            try {
                const entry = await DecoupageModel.create(items[i]);
                if (entry) {
                    created++;
                } else {
                    skipped++;
                }
            } catch (err) {
                errors.push({ index: i, message: err.message });
                skipped++;
            }
        }

        res.status(201).json({
            success: true,
            message: `Import termine: ${created} crees, ${skipped} ignores`,
            data: { created, skipped, errors }
        });
    } catch (error) {
        next(error);
    }
};
