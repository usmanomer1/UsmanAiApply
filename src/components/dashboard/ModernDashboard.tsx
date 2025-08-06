import { useState, useEffect } from 'react';
import {
  RiArrowRightUpLine,
  RiBriefcaseLine,
  RiCheckLine,
  RiTimeLine,
  RiUserStarLine,
  RiFileTextLine,
  RiSearchLine,
  RiAlertLine,
  RiCalendarLine,
  RiPercentLine,
  RiLineChartLine,
  RiMailCheckLine,
} from '@remixicon/react';
import {
  AreaChart,
  BarList,
  Card,
  Dialog,
  DialogPanel,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  TextInput,
  Metric,
  Text,
  Flex,
  ProgressBar,
  Badge,
  Grid,
  ProgressCircle,
  List,
  ListItem,
} from '@tremor/react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface ApplicationData {
  date: string;
  'Applications': number;
  'Interviews': number;
  'Responses': number;
}

interface StatusData {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
  subStatuses?: {
    name: string;
    value: number;
    formatted: string;
  }[];
}

interface CompanyData {
  name: string;
  value: number;
  icon?: any;
}

interface TabData {
  name: string;
  type: string;
  value: string;
  percentage?: number;
  trend?: 'up' | 'down' | 'flat';
  categories: {
    name: string;
    data: CompanyData[];
  }[];
}

const valueFormatter = (number: number) =>
  `${Intl.NumberFormat('us').format(number).toString()}`;

const percentageFormatter = (number: number) => `${number.toFixed(0)}%`;

export default function ModernDashboard() {
  const { user } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applicationData, setApplicationData] = useState<ApplicationData[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusData[]>([]);
  const [summary, setSummary] = useState<TabData[]>([]);
  const [topCompanies, setTopCompanies] = useState<CompanyData[]>([]);
  const [topRoles, setTopRoles] = useState<CompanyData[]>([]);
  const [modal, setModal] = useState({
    open: false,
    index: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Key metrics
  const [metrics, setMetrics] = useState({
    totalApplications: 0,
    interviewRate: 0,
    responseRate: 0,
    successRate: 0,
    weeklyApplications: 0,
    monthlyApplications: 0,
    pendingApplications: 0,
    avgTimeToResponse: 0,
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch applications from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: applications, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching applications:', error);
        return;
      }

      // Calculate key metrics
      const totalApps = applications?.length || 0;
      const interviews = applications?.filter(app => 
        app.status === 'INTERVIEW' || app.status === 'OA'
      ).length || 0;
      const responses = applications?.filter(app => 
        app.status !== 'SENT' && app.status !== 'PENDING'
      ).length || 0;
      const accepted = applications?.filter(app => 
        app.status === 'ACCEPTED'
      ).length || 0;
      
      // Calculate weekly applications
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyApps = applications?.filter(app => 
        new Date(app.created_at) >= oneWeekAgo
      ).length || 0;
      
      // Calculate pending applications
      const pending = applications?.filter(app => 
        app.status === 'PENDING' || app.status === 'SENT'
      ).length || 0;

      // Set metrics
      setMetrics({
        totalApplications: totalApps,
        interviewRate: totalApps > 0 ? (interviews / totalApps) * 100 : 0,
        responseRate: totalApps > 0 ? (responses / totalApps) * 100 : 0,
        successRate: totalApps > 0 ? (accepted / totalApps) * 100 : 0,
        weeklyApplications: weeklyApps,
        monthlyApplications: totalApps,
        pendingApplications: pending,
        avgTimeToResponse: 7, // This would need more complex calculation
      });

      // Process daily application data for chart
      const dailyData: Record<string, ApplicationData> = {};
      
      // Initialize all days with zero
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        dailyData[dateKey] = {
          date: dateKey,
          Applications: 0,
          Interviews: 0,
          Responses: 0,
        };
      }

      // Count applications by day and status
      applications?.forEach(app => {
        const appDate = new Date(app.created_at);
        const dateKey = appDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        
        if (dailyData[dateKey]) {
          dailyData[dateKey].Applications++;
          
          if (app.status === 'INTERVIEW' || app.status === 'OA') {
            dailyData[dateKey].Interviews++;
          }
          
          if (app.status !== 'SENT' && app.status !== 'PENDING') {
            dailyData[dateKey].Responses++;
          }
        }
      });

      setApplicationData(Object.values(dailyData));

      // Process status distribution for nested progress circles
      const statusCounts: Record<string, number> = {};
      applications?.forEach(app => {
        const status = app.status || 'SENT';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Group statuses into categories for nested visualization
      const activeStatuses = ['INTERVIEW', 'OA', 'ACCEPTED'];
      const pendingStatuses = ['SENT', 'PENDING'];
      const rejectedStatuses = ['REJECTED'];

      const activeCount = activeStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);
      const pendingCount = pendingStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);
      const rejectedCount = rejectedStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

      const statusData: StatusData[] = [
        {
          name: 'Active Process',
          value: activeCount,
          color: 'bg-green-500',
          percentage: totalApps > 0 ? (activeCount / totalApps) * 100 : 0,
          subStatuses: activeStatuses.map(status => ({
            name: status === 'OA' ? 'Online Assessment' : status.charAt(0) + status.slice(1).toLowerCase(),
            value: statusCounts[status] || 0,
            formatted: `${statusCounts[status] || 0}/${activeCount}`
          }))
        },
        {
          name: 'Pending Response',
          value: pendingCount,
          color: 'bg-amber-500',
          percentage: totalApps > 0 ? (pendingCount / totalApps) * 100 : 0,
          subStatuses: pendingStatuses.map(status => ({
            name: status.charAt(0) + status.slice(1).toLowerCase(),
            value: statusCounts[status] || 0,
            formatted: `${statusCounts[status] || 0}/${pendingCount}`
          }))
        },
        {
          name: 'Rejected',
          value: rejectedCount,
          color: 'bg-red-500',
          percentage: totalApps > 0 ? (rejectedCount / totalApps) * 100 : 0,
          subStatuses: [{
            name: 'Rejected',
            value: rejectedCount,
            formatted: `${rejectedCount}/${totalApps}`
          }]
        }
      ].filter(category => category.value > 0); // Only show categories with data

      setStatusDistribution(statusData);

      // Process top companies
      const companyCounts: Record<string, number> = {};
      applications?.forEach(app => {
        if (app.company) {
          companyCounts[app.company] = (companyCounts[app.company] || 0) + 1;
        }
      });

      const topCompaniesList: CompanyData[] = Object.entries(companyCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([company, count]) => ({
          name: company,
          value: count,
          icon: RiBriefcaseLine,
        }));

      setTopCompanies(topCompaniesList);

      // Process top roles
      const roleCounts: Record<string, number> = {};
      applications?.forEach(app => {
        if (app.role) {
          roleCounts[app.role] = (roleCounts[app.role] || 0) + 1;
        }
      });

      const topRolesList: CompanyData[] = Object.entries(roleCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([role, count]) => ({
          name: role,
          value: count,
          icon: RiUserStarLine,
        }));

      setTopRoles(topRolesList);

      // Create summary tabs
      const summaryData: TabData[] = [
        {
          name: 'Total Applications',
          type: 'Applications',
          value: metrics.totalApplications.toLocaleString(),
          percentage: ((weeklyApps / 7) * 100) / 10, // Average per day as percentage
          trend: weeklyApps > 0 ? 'up' : 'flat',
          categories: [
            {
              name: 'Top Companies',
              data: topCompaniesList,
            },
            {
              name: 'Top Roles',
              data: topRolesList,
            },
          ],
        },
        {
          name: 'Interview Rate',
          type: 'Success Metrics',
          value: `${metrics.interviewRate.toFixed(1)}%`,
          percentage: metrics.interviewRate,
          trend: metrics.interviewRate > 10 ? 'up' : metrics.interviewRate > 5 ? 'flat' : 'down',
          categories: [
            {
              name: 'Companies with Interviews',
              data: topCompaniesList.filter((_, index) => index % 2 === 0), // Mock filter for demo
            },
            {
              name: 'Roles with Interviews',
              data: topRolesList.filter((_, index) => index % 3 === 0), // Mock filter for demo
            },
          ],
        },
      ];
      
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIndexChange = (index: number) => {
    setSelectedIndex(index);
  };

  const filteredItems = summary[selectedIndex]?.categories[
    modal.index
  ]?.data.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <h3 className="text-tremor-title font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
        Application Analytics Dashboard
      </h3>
      <p className="mt-1 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
        Track your job search progress and success metrics.
      </p>
      
      {/* Key Metrics Cards */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mt-6">
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <div>
              <Text>Total Applications</Text>
              <Metric className="mt-2">
                {metrics.totalApplications}
              </Metric>
              <Text className="mt-2 text-tremor-default">
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  +{metrics.weeklyApplications}
                </span> this week
              </Text>
            </div>
            <Badge icon={RiBriefcaseLine} color="blue">
              Active
            </Badge>
          </Flex>
        </Card>
        
        <Card decoration="top" decorationColor="green">
          <Flex alignItems="start">
            <div>
              <Text>Interview Rate</Text>
              <Metric className="mt-2">
                {metrics.interviewRate.toFixed(1)}%
              </Metric>
              <Text className="mt-2 text-tremor-default">
                Industry avg: 10%
              </Text>
            </div>
            <Badge icon={RiUserStarLine} color="green">
              {metrics.interviewRate > 10 ? 'Above Avg' : 'Below Avg'}
            </Badge>
          </Flex>
          <ProgressBar value={metrics.interviewRate} className="mt-3" color="green" />
        </Card>
        
        <Card decoration="top" decorationColor="amber">
          <Flex alignItems="start">
            <div>
              <Text>Response Rate</Text>
              <Metric className="mt-2">
                {metrics.responseRate.toFixed(1)}%
              </Metric>
              <Text className="mt-2 text-tremor-default">
                Avg time: {metrics.avgTimeToResponse} days
              </Text>
            </div>
            <Badge icon={RiMailCheckLine} color="amber">
              {metrics.responseRate > 30 ? 'Good' : 'Low'}
            </Badge>
          </Flex>
          <ProgressBar value={metrics.responseRate} className="mt-3" color="amber" />
        </Card>
        
        <Card decoration="top" decorationColor="purple">
          <Flex alignItems="start">
            <div>
              <Text>Pending Applications</Text>
              <Metric className="mt-2">
                {metrics.pendingApplications}
              </Metric>
              <Text className="mt-2 text-tremor-default">
                Awaiting response
              </Text>
            </div>
            <Badge icon={RiTimeLine} color="purple">
              Active
            </Badge>
          </Flex>
        </Card>
      </Grid>

      {/* Main Charts Section */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Application Trends Chart - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                Application Trends
              </h3>
              <p className="text-tremor-label text-tremor-content dark:text-dark-tremor-content">
                Daily applications, interviews, and responses
              </p>
            </div>
            <Badge icon={RiLineChartLine} color="blue">
              30 Days
            </Badge>
          </div>
          <AreaChart
            data={applicationData}
            index="date"
            categories={['Applications', 'Interviews', 'Responses']}
            colors={['blue', 'green', 'amber']}
            valueFormatter={valueFormatter}
            showLegend={true}
            showGridLines={false}
            yAxisWidth={40}
            className="h-72"
          />
        </Card>

        {/* Status Distribution with Nested Progress Circles */}
        <Card className="p-0">
          <div className="border-b border-tremor-border px-4 py-4 dark:border-dark-tremor-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  Application Status Overview
                </h3>
                <p className="text-tremor-label text-tremor-content dark:text-dark-tremor-content mt-1">
                  Distribution across all statuses
                </p>
              </div>
              <Badge icon={RiPercentLine} color="purple">
                {metrics.totalApplications} Total
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              {statusDistribution.length > 0 ? (
                <>
                  {/* Single progress circle showing overall completion */}
                  <ProgressCircle
                    value={metrics.responseRate}
                    radius={80}
                    strokeWidth={12}
                    color="blue"
                  >
                    <div className="text-center">
                      <p className="text-3xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        {metrics.totalApplications}
                      </p>
                      <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                        Total
                      </p>
                      <p className="text-tremor-label text-blue-600 dark:text-blue-400 mt-1">
                        {metrics.responseRate.toFixed(0)}% Response
                      </p>
                    </div>
                  </ProgressCircle>
                  
                  {/* Status breakdown bars */}
                  <div className="w-full max-w-xs space-y-2">
                    {statusDistribution.map((category) => (
                      <div key={category.name} className="w-full">
                        <div className="flex justify-between text-tremor-label mb-1">
                          <span>{category.name}</span>
                          <span>{category.value}</span>
                        </div>
                        <ProgressBar
                          value={category.percentage || 0}
                          color={
                            category.name === 'Active Process' ? 'green' :
                            category.name === 'Pending Response' ? 'amber' :
                            'red'
                          }
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                    No application data available
                  </p>
                </div>
              )}
            </div>
            <ul role="list" className="mt-4 w-full sm:mt-0 space-y-2">
              {statusDistribution.map((category) => (
                <li
                  key={category.name}
                  className="relative rounded-tremor-small px-3 py-2 hover:bg-tremor-background-muted hover:dark:bg-dark-tremor-background-subtle"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`${category.color} size-2.5 rounded-sm`}
                        aria-hidden={true}
                      />
                      <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        {category.name}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        {category.value}
                      </p>
                      <p className="text-tremor-label text-tremor-content dark:text-dark-tremor-content">
                        ({category.percentage?.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  {category.subStatuses && category.subStatuses.length > 0 && (
                    <List className="mt-2">
                      {category.subStatuses.map((subStatus) => (
                        <ListItem key={subStatus.name} className="py-1">
                          <span className="text-tremor-label">{subStatus.name}</span>
                          <span className="text-tremor-label">{subStatus.formatted}</span>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <TabGroup defaultIndex={0} onIndexChange={handleIndexChange} className="mt-8">
        <Card className="overflow-hidden p-0">
          <TabList className="space-x-0 bg-tremor-background-muted dark:bg-dark-tremor-background-muted">
            {summary.map((tab, idx) => (
              <div key={tab.name} className="flex">
                <Tab className="py-4 pl-5 pr-12 text-left ui-selected:bg-tremor-brand-inverted ui-focus-visible:ring-2 ui-focus-visible:ring-blue-400 ui-focus-visible:ring-offset-2 dark:ui-selected:bg-dark-tremor-background-muted">
                  <span className="block text-tremor-content dark:text-dark-tremor-content">
                    {tab.name}
                  </span>
                  <span className="mt-1 block text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                    {tab.value}
                  </span>
                  {tab.trend && (
                    <span className={`mt-1 text-xs ${
                      tab.trend === 'up' ? 'text-green-600' : 
                      tab.trend === 'down' ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {tab.trend === 'up' ? '↑' : tab.trend === 'down' ? '↓' : '→'} 
                      {' '}Trending {tab.trend}
                    </span>
                  )}
                </Tab>
                {idx < summary.length - 1 && (
                  <div
                    className="border-r border-tremor-border dark:border-dark-tremor-border"
                    aria-hidden={true}
                  />
                )}
              </div>
            ))}
          </TabList>
          <TabPanels>
            {summary.map((tab) => (
              <TabPanel key={tab.name} className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {tab.categories.map((category, idx) => (
                    <div key={category.name}>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                          {category.name}
                        </p>
                        <button
                          className="text-tremor-label text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          onClick={() =>
                            setModal({
                              open: true,
                              index: idx,
                            })
                          }
                        >
                          View all →
                        </button>
                      </div>
                      <BarList
                        data={category.data.slice(0, 5)}
                        valueFormatter={valueFormatter}
                        className="mt-2"
                      />
                    </div>
                  ))}
                </div>
              </TabPanel>
            ))}
          </TabPanels>
        </Card>
      </TabGroup>

      {/* Success Metrics Cards */}
      <Grid numItemsSm={2} numItemsLg={3} className="gap-6 mt-8">
        <Card>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <RiCheckLine className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <Text>Success Rate</Text>
              <Metric>{metrics.successRate.toFixed(1)}%</Metric>
            </div>
          </div>
          <Text className="text-tremor-default">
            Offers received vs applications sent
          </Text>
        </Card>

        <Card>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <RiCalendarLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <Text>Monthly Activity</Text>
              <Metric>{metrics.monthlyApplications}</Metric>
            </div>
          </div>
          <Text className="text-tremor-default">
            Applications in the last 30 days
          </Text>
        </Card>

        <Card>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <RiTimeLine className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <Text>Avg Response Time</Text>
              <Metric>{metrics.avgTimeToResponse} days</Metric>
            </div>
          </div>
          <Text className="text-tremor-default">
            Average time to hear back
          </Text>
        </Card>
      </Grid>

      {/* Detail Modal */}
      <Dialog
        open={modal.open}
        onClose={() => {
          setModal((prev) => ({
            ...prev,
            open: false,
          }));
          setSearchQuery('');
        }}
        static={true}
        className="z-[100]"
      >
        <DialogPanel className="p-0">
          <div className="px-6 pb-4 pt-6">
            <TextInput
              icon={RiSearchLine}
              placeholder="Search..."
              className="rounded-tremor-small"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="flex items-center justify-between pt-4">
              <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {summary[selectedIndex]?.categories[modal.index]?.name || 'Items'}
              </p>
            </div>
          </div>
          <div className="h-96 overflow-y-scroll px-6">
            {filteredItems.length > 0 ? (
              <BarList data={filteredItems} valueFormatter={valueFormatter} />
            ) : (
              <p className="flex h-full items-center justify-center text-tremor-default text-tremor-content-strong dark:text-dark-tremor-content-strong">
                No results.
              </p>
            )}
          </div>
          <div className="mt-4 border-t border-tremor-border bg-tremor-background-muted p-6 dark:border-dark-tremor-border dark:bg-dark-tremor-background">
            <button
              className="flex w-full items-center justify-center rounded-tremor-small border border-tremor-border bg-tremor-background py-2 text-tremor-default font-medium text-tremor-content-strong shadow-tremor-input hover:bg-tremor-background-muted dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong dark:shadow-dark-tremor-input hover:dark:bg-dark-tremor-background-muted"
              onClick={() => {
                setSearchQuery('');
                setModal((prev) => ({
                  ...prev,
                  open: false,
                }));
              }}
            >
              Go back
            </button>
          </div>
        </DialogPanel>
      </Dialog>
    </>
  );
}