import { ReportModel } from './models/ReportModel.js';
import { ReportView } from './views/ReportView.js';
import { ReportController } from './controllers/ReportController.js';

window.addEventListener('DOMContentLoaded', () => {
    const app = new ReportController(new ReportModel(), new ReportView());
});
