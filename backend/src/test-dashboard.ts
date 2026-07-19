import dashboardService from './services/dashboardService';

async function main() {
  console.log('Testing dashboard queries...');
  try {
    const metrics = await dashboardService.getAdminDashboardMetrics();
    console.log('Metrics successful:', metrics);
  } catch (err) {
    console.error('Metrics failed:', err);
  }

  try {
    const approvals = await dashboardService.getPendingApprovals();
    console.log('Pending approvals successful:', approvals);
  } catch (err) {
    console.error('Pending approvals failed:', err);
  }

  try {
    const summary = await dashboardService.getFinancialSummary();
    console.log('Financial summary successful:', summary);
  } catch (err) {
    console.error('Financial summary failed:', err);
  }

  try {
    const activities = await dashboardService.getRecentActivities();
    console.log('Recent activities successful:', activities.length);
  } catch (err) {
    console.error('Recent activities failed:', err);
  }

  try {
    const alerts = await dashboardService.getDashboardAlerts();
    console.log('Alerts successful:', alerts);
  } catch (err) {
    console.error('Alerts failed:', err);
  }

  try {
    const health = await dashboardService.getSystemHealth();
    console.log('System health successful:', health);
  } catch (err) {
    console.error('System health failed:', err);
  }

  try {
    const risk = await dashboardService.getStudentsAtRisk();
    console.log('Students at risk successful:', risk);
  } catch (err) {
    console.error('Students at risk failed:', err);
  }

  process.exit(0);
}

main();
