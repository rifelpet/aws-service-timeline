import json
from datetime import datetime

old_data = {}
with open('region_timeline.json') as fd:
  old_data = json.load(fd)

new_data_by_region = {}
new_data_by_service = {}
new_data_region_launch_dates = {}
new_data_service_launch_dates = {}

for region in old_data.keys():
  new_data_by_region[region] = {}
  for service in old_data[region].keys():
    data = old_data[region][service]
    service = service.replace('api.', '')
    new_data_by_region[region][service] = data
    if service not in new_data_by_service:
      new_data_by_service[service] = {}
    new_data_by_service[service][region] = data
    curr_date = datetime.strptime(data['date'], '%Y-%m-%d')

    if region not in new_data_region_launch_dates or curr_date < datetime.strptime(new_data_region_launch_dates[region], '%Y-%m-%d'):
      new_data_region_launch_dates[region] = data['date']
    if service not in new_data_service_launch_dates or curr_date < datetime.strptime(new_data_service_launch_dates[service], '%Y-%m-%d'):
      new_data_service_launch_dates[service] = data['date']

data = {
  'ByRegion': new_data_by_region,
  'ByService': new_data_by_service,
  'ServiceLaunchDates': new_data_service_launch_dates,
  'RegionLaunchDates': new_data_region_launch_dates
}
print(data)
