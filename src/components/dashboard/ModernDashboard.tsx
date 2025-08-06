import { useState, useEffect } from 'react';
import {
  RiArrowRightUpLine,
  RiBriefcaseLine,
  RiCheckLine,
  RiTimeLine,
  RiRobotLine,
  RiFileTextLine,
  RiSearchLine,
  RiTrendingUpLine,
  RiAlertLine,
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
} from '@tremor/react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserUsage, getUsageHistory, getAutomationSessions } from '../../lib/usageTracking';
import { supabase } from '../../lib/supabase';

interface UsageData {
  date: string;
  'Applications Submitted': number;
  'Automation Steps': number;
}

interface SessionData {
  name: string;
  value: number;
  icon?: any;
  metadata?: any;
}

interface TabData {
  name: string;
  type: string;
  value: string;
  percentage?: number;
  categories: {
    name: string;
    data: SessionData[];
  }[];
}

const valueFormatter = (number: number) =>
  `${Intl.NumberFormat('us').format(number).toString()}`;

export default function ModernDashboard() {
  const { user } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [summary, setSummary] = useState<TabData[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);
  const [topLocations, setTopLocations] = useState<SessionData[]>([]);
  const [modal, setModal] = useState({
    open: false,
    index: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch usage history for chart
      const history = await getUsageHistory(user.id, 30);
      const chartData = history.map(day => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
        'Applications Submitted': day.applications || 0,
        'Automation Steps': day.steps || 0,
      }));
      setUsageData(chartData);

      // Fetch current usage
      const usage = await getUserUsage(user.id);
      
      // Fetch recent automation sessions
      const sessions = await getAutomationSessions(user.id, 20);
      
      // Process sessions for top job titles
      const jobTitleCounts = sessions.reduce((acc: Record<string, number>, session: any) => {
        if (session.job_title) {
          acc[session.job_title] = (acc[session.job_title] || 0) + 1;
        }
        return acc;
      }, {});
      
      const topJobTitles: SessionData[] = Object.entries(jobTitleCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([title, count]) => ({
          name: title,
          value: count,
          icon: RiBriefcaseLine,
        }));

      // Process sessions for top locations
      const locationCounts = sessions.reduce((acc: Record<string, number>, session: any) => {
        if (session.location) {
          acc[session.location] = (acc[session.location] || 0) + 1;
        }
        return acc;
      }, {});
      
      const topLocationsList: SessionData[] = Object.entries(locationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([location, count]) => ({
          name: location,
          value: count,
          icon: RiSearchLine,
        }));
      
      setTopLocations(topLocationsList);

      // Process recent sessions for activity list
      const recentSessionsList: SessionData[] = sessions
        .slice(0, 10)
        .map((session: any) => ({
          name: `${session.job_title || 'Job Search'} - ${session.location || 'Remote'}`,
          value: session.step_count || 0,
          icon: session.status === 'completed' ? RiCheckLine : 
                session.status === 'failed' ? RiAlertLine : RiTimeLine,
          metadata: {
            status: session.status,
            applications: session.applications_submitted || 0,
            date: new Date(session.started_at).toLocaleDateString(),
          }
        }));
      
      setRecentSessions(recentSessionsList);

      // Calculate total stats
      const totalApplications = sessions.reduce((sum: number, s: any) => 
        sum + (s.applications_submitted || 0), 0);
      const totalSteps = usage.automation_steps.used;

      // Create summary tabs
      const summaryData: TabData[] = [
        {
          name: 'Automation Steps',
          type: 'Steps',
          value: totalSteps.toLocaleString(),
          percentage: usage.automation_steps.percentage,
          categories: [
            {
              name: 'Top Job Searches',
              data: topJobTitles,
            },
            {
              name: 'Top Locations',
              data: topLocationsList,
            },
          ],
        },
        {
          name: 'Applications Submitted',
          type: 'Applications',
          value: totalApplications.toLocaleString(),
          percentage: (totalApplications / (usage.automation_steps.limit || 1)) * 100,
          categories: [
            {
              name: 'Recent Sessions',
              data: recentSessionsList,
            },
            {
              name: 'Top Locations',
              data: topLocationsList,
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
        Job Application Analytics
      </h3>
      <p className="mt-1 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
        Track your job search progress and automation usage.
      </p>
      
      {/* Quick Stats Cards */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mt-6">
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <div>
              <Text>Total Applications</Text>
              <Metric className="mt-2">
                {summary[1]?.value || '0'}
              </Metric>
            </div>
            <Badge icon={RiBriefcaseLine} color="blue">
              Active
            </Badge>
          </Flex>
        </Card>
        
        <Card decoration="top" decorationColor="green">
          <Flex alignItems="start">
            <div>
              <Text>Automation Steps</Text>
              <Metric className="mt-2">
                {summary[0]?.value || '0'}
              </Metric>
            </div>
            <Badge icon={RiRobotLine} color="green">
              {summary[0]?.percentage?.toFixed(0) || '0'}%
            </Badge>
          </Flex>
          <ProgressBar value={summary[0]?.percentage || 0} className="mt-3" color="green" />
        </Card>
        
        <Card decoration="top" decorationColor="amber">
          <Flex alignItems="start">
            <div>
              <Text>Success Rate</Text>
              <Metric className="mt-2">
                {recentSessions.filter(s => s.metadata?.status === 'completed').length > 0
                  ? `${((recentSessions.filter(s => s.metadata?.status === 'completed').length / recentSessions.length) * 100).toFixed(0)}%`
                  : 'N/A'}
              </Metric>
            </div>
            <Badge icon={RiTrendingUpLine} color="amber">
              Trending
            </Badge>
          </Flex>
        </Card>
        
        <Card decoration="top" decorationColor="purple">
          <Flex alignItems="start">
            <div>
              <Text>Active Sessions</Text>
              <Metric className="mt-2">
                {recentSessions.filter(s => s.metadata?.status === 'running').length}
              </Metric>
            </div>
            <Badge icon={RiTimeLine} color="purple">
              Live
            </Badge>
          </Flex>
        </Card>
      </Grid>

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
                <AreaChart
                  data={usageData}
                  index="date"
                  categories={[tab.name]}
                  valueFormatter={valueFormatter}
                  showGradient={false}
                  showLegend={false}
                  yAxisWidth={45}
                  className="hidden h-96 sm:block"
                  colors={tab.name === 'Automation Steps' ? ['green'] : ['blue']}
                />
                <AreaChart
                  data={usageData}
                  index="date"
                  categories={[tab.name]}
                  valueFormatter={valueFormatter}
                  showGradient={false}
                  showLegend={false}
                  showYAxis={false}
                  startEndOnly={true}
                  className="h-72 sm:hidden"
                  colors={tab.name === 'Automation Steps' ? ['green'] : ['blue']}
                />
              </TabPanel>
            ))}
          </TabPanels>
        </Card>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          {summary[selectedIndex]?.categories.map((category, idx) => (
            <Card key={category.name} className="relative pb-14">
              <div className="flex items-center justify-between">
                <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  {category.name}
                </p>
                <span className="text-tremor-label font-medium uppercase text-tremor-content dark:text-dark-tremor-content">
                  {summary[selectedIndex].type}
                </span>
              </div>
              <BarList
                data={category.data.slice(0, 5)}
                valueFormatter={valueFormatter}
                className="mt-4"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-center rounded-b-tremor-default bg-gradient-to-t from-tremor-background to-transparent py-3 dark:from-dark-tremor-background">
                <button
                  className="flex items-center justify-center gap-x-1.5 rounded-tremor-full border border-tremor-border bg-tremor-background px-2.5 py-1.5 text-tremor-label font-medium text-tremor-content-strong shadow-tremor-input hover:bg-tremor-background-muted dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong dark:shadow-dark-tremor-input hover:dark:bg-dark-tremor-background-muted"
                  onClick={() =>
                    setModal({
                      open: true,
                      index: idx,
                    })
                  }
                >
                  Show more
                  <RiArrowRightUpLine
                    className="-mr-px size-4 shrink-0"
                    aria-hidden={true}
                  />
                </button>
              </div>
            </Card>
          ))}
        </div>

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
                <span className="text-tremor-label font-medium uppercase text-tremor-content dark:text-dark-tremor-content">
                  {summary[selectedIndex]?.type || 'Count'}
                </span>
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
      </TabGroup>
    </>
  );
}