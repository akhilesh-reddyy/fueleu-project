"use strict";
// =============================================================================
// FuelEU Maritime — HTTP Adapter Layer
// Express controllers + router + error handler + server bootstrap
// Zero business logic — all orchestration delegated to use-case layer
// =============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouter = buildRouter;
exports.errorMiddleware = errorMiddleware;
exports.createApp = createApp;
const express_1 = __importStar(require("express"));
// =============================================================================
// HTTP helpers
// =============================================================================
function statusFor(err) {
    switch (err.code) {
        case "NOT_FOUND": return 404;
        case "VALIDATION": return 400;
        case "CONFLICT": return 409;
        case "DOMAIN_RULE": return 422;
        default: return 500;
    }
}
function handle(fn, successStatus = 200) {
    return async (req, res, next) => {
        try {
            const result = await fn(req, res);
            if (result.ok) {
                res.status(successStatus).json({ data: result.value });
            }
            else {
                res.status(statusFor(result.error)).json({ error: result.error });
            }
        }
        catch (err) {
            next(err);
        }
    };
}
// =============================================================================
// Input sanitisers
// =============================================================================
function requireString(value, field, maxLen = 200) {
    if (typeof value !== "string" || !value.trim()) {
        throw { code: "VALIDATION", message: `${field} is required`, field };
    }
    if (value.length > maxLen) {
        throw { code: "VALIDATION", message: `${field} must be ≤ ${maxLen} chars`, field };
    }
    return value.trim();
}
function requireYear(value, field = "year") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 2024 || n > 2050) {
        throw { code: "VALIDATION", message: `${field} must be 2024–2050`, field };
    }
    return n;
}
function requirePositiveNumber(value, field) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        throw { code: "VALIDATION", message: `${field} must be a positive number`, field };
    }
    return n;
}
function requireArray(value, field, minLen = 1) {
    if (!Array.isArray(value) || value.length < minLen) {
        throw { code: "VALIDATION", message: `${field} must be an array with ≥ ${minLen} item(s)`, field };
    }
    return value;
}
function validate(fn) {
    try {
        return { ok: true, value: fn() };
    }
    catch (e) {
        const err = e;
        if (err.code)
            return { ok: false, error: err };
        throw e;
    }
}
// =============================================================================
// Controllers
// =============================================================================
function buildRouteControllers(uc) {
    const listRoutes = async (req, res, next) => {
        try {
            const year = req.query.year !== undefined ? requireYear(req.query.year) : undefined;
            const result = await uc.listRoutes({
                year,
                vesselType: req.query.vesselType,
                fuelType: req.query.fuelType,
            });
            result.ok
                ? res.status(200).json({ data: result.value })
                : res.status(statusFor(result.error)).json({ error: result.error });
        }
        catch (e) {
            next(e);
        }
    };
    const setBaseline = handle(async (req) => {
        const v = validate(() => requireString(req.params.id, "id"));
        if (!v.ok)
            return v;
        return uc.setBaseline({ routeId: v.value });
    });
    const getComparison = handle(async (req) => {
        const v = validate(() => ({ year: requireYear(req.query.year, "year") }));
        if (!v.ok)
            return v;
        return uc.getComparison(v.value);
    });
    return { listRoutes, setBaseline, getComparison };
}
function buildComplianceControllers(uc) {
    const getComplianceBalance = handle(async (req) => {
        const v = validate(() => ({
            shipId: requireString(req.query.shipId, "shipId"),
            routeId: requireString(req.query.routeId, "routeId"),
            year: requireYear(req.query.year, "year"),
        }));
        if (!v.ok)
            return v;
        return uc.computeCB(v.value);
    });
    const getAdjustedCB = handle(async (req) => {
        const v = validate(() => ({
            shipId: requireString(req.query.shipId, "shipId"),
            year: requireYear(req.query.year, "year"),
        }));
        if (!v.ok)
            return v;
        return uc.getAdjustedCB(v.value);
    });
    return { getComplianceBalance, getAdjustedCB };
}
function buildBankingControllers(uc) {
    const listBankRecords = handle(async (req) => {
        const v = validate(() => ({
            shipId: requireString(req.query.shipId, "shipId"),
            year: requireYear(req.query.year, "year"),
        }));
        if (!v.ok)
            return v;
        return uc.listBankRecords(v.value);
    });
    const bankSurplus = handle(async (req) => {
        const v = validate(() => ({
            shipId: requireString(req.body?.shipId, "shipId"),
            routeId: requireString(req.body?.routeId, "routeId"),
            year: requireYear(req.body?.year, "year"),
        }));
        if (!v.ok)
            return v;
        return uc.bankSurplus(v.value);
    }, 201);
    const applyBanked = handle(async (req) => {
        const v = validate(() => ({
            shipId: requireString(req.body?.shipId, "shipId"),
            routeId: requireString(req.body?.routeId, "routeId"),
            year: requireYear(req.body?.year, "year"),
            amountToApply: requirePositiveNumber(req.body?.amountToApply, "amountToApply"),
        }));
        if (!v.ok)
            return v;
        return uc.applyBanked(v.value);
    });
    return { listBankRecords, bankSurplus, applyBanked };
}
function buildPoolControllers(uc) {
    const createPool = handle(async (req) => {
        const v = validate(() => {
            const year = requireYear(req.body?.year, "year");
            const rawMembers = requireArray(req.body?.members, "members", 2);
            const members = rawMembers.map((m, i) => ({
                shipId: requireString(m?.shipId, `members[${i}].shipId`),
                routeId: requireString(m?.routeId, `members[${i}].routeId`),
            }));
            return { year, members };
        });
        if (!v.ok)
            return v;
        return uc.createPool(v.value);
    }, 201);
    return { createPool };
}
// =============================================================================
// Router assembly
// =============================================================================
function buildRouter(uc) {
    const router = (0, express_1.Router)();
    const routes = buildRouteControllers(uc);
    const compliance = buildComplianceControllers(uc);
    const banking = buildBankingControllers(uc);
    const pools = buildPoolControllers(uc);
    // IMPORTANT: /routes/comparison must be registered before /routes/:id/baseline
    router.get("/routes", routes.listRoutes);
    router.get("/routes/comparison", routes.getComparison);
    router.post("/routes/:id/baseline", routes.setBaseline);
    router.get("/compliance/cb", compliance.getComplianceBalance);
    router.get("/compliance/adjusted-cb", compliance.getAdjustedCB);
    router.get("/banking/records", banking.listBankRecords);
    router.post("/banking/bank", banking.bankSurplus);
    router.post("/banking/apply", banking.applyBanked);
    router.post("/pools", pools.createPool);
    return router;
}
// =============================================================================
// Error middleware
// =============================================================================
function errorMiddleware(err, _req, res, _next) {
    console.error("[unhandled error]", err);
    const shaped = err;
    if (shaped?.code) {
        res.status(statusFor(shaped)).json({ error: shaped });
        return;
    }
    res.status(500).json({ error: { code: "INTERNAL", message: "An unexpected error occurred" } });
}
// =============================================================================
// App factory (imported by server.ts and by tests)
// =============================================================================
function createApp(uc) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: "256kb" }));
    app.use(express_1.default.urlencoded({ extended: false }));
    app.use((req, _res, next) => {
        req.headers["x-request-id"] ??= crypto.randomUUID();
        next();
    });
    app.use("/api/v1", buildRouter(uc));
    app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
    app.use((_req, res) => res.status(404).json({
        error: { code: "NOT_FOUND", message: "Route not found", entity: "endpoint", id: "" },
    }));
    app.use(errorMiddleware);
    return app;
}
//# sourceMappingURL=http.js.map