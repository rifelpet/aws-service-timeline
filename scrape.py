#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

# Inspired by:
# https://github.com/AwsGeek/aws-history https://www.awsgeek.com/pages/AWS-History/
# https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/


REGIONS_XML_1_4_2 = './aws-sdk-java/src/main/resources/etc/regions.xml'
REGIONS_XML_1_7_0 = './aws-sdk-java/src/main/resources/com/amazonaws/regions/regions.xml'
REGIONS_XML_1_8_10 = './aws-sdk-java/aws-java-sdk-core/src/main/resources/com/amazonaws/regions/regions.xml'
ENDPOINTS_JSON_1_10_51 = './aws-sdk-java/aws-java-sdk-core/src/main/resources/com/amazonaws/partitions/endpoints.json'

# Services that arent region-specific
SERVICE_BLACKLIST = ['discovery', 'groundstation', 'health', 'route53domains', 'ce', 'budgets', 'route53', 'iam']

def run_command(cmd, cwd='./aws-sdk-java', retries=5, fatal=True) -> subprocess.CompletedProcess:
  result = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
  if result.returncode != 0:
    if 'too many open files' in result.stderr and retries > 0:
      time.sleep(2.0/retries)
      return run_command(cmd, cwd, retries-1)
    print('command failed', ' '.join(cmd))
    print(result.stderr)
    if fatal:
      sys.exit(1)
  return result

# Parses the endpoints.json file from 1.10.51 and newer
def parse_endpoints_json(region_timeline, tag_date: str, filename: str):
  with open(filename) as fd:
    endpoint_info = json.load(fd)
    for partition in endpoint_info['partitions']:
      if partition['partition'] != 'aws':
        continue
      for service, endpoints in partition['services'].items():
        service = service.replace('api.', '')
        if service in SERVICE_BLACKLIST:
          continue
        #print(service, endpoints['endpoints'])
        for region in endpoints['endpoints'].keys():
          region = region.lower()
          if 'dualstack' in region or 'fips' in region.lower() or region in ['local', 'sandbox']:
            continue
          if region not in region_timeline:
            print('Adding new region', region)
            region_timeline[region] = {}
          if service not in region_timeline[region]:
            region_timeline[region][service] = {'date': tag_date}
  return region_timeline

# Parses the regions.xml file from 1.8.10 to 1.10.51
def parse_regions_xml(region_timeline, tag_date: str, filename: str):
  tree = ET.parse(filename)
  for child1 in tree.getroot():
    if child1.tag != 'Services':
      continue
    for service in child1:
      service_name = 'unknown'
      for child2 in service:
        if child2.tag == 'Name':
          service_name = child2.text
        elif child2.tag == 'RegionName':
          region = child2.text
          if region not in region_timeline:
            print('Adding new region', region)
            region_timeline[region] = {}
          if service_name not in region_timeline[region]:
            region_timeline[region][service_name] = {'date': tag_date}
  return region_timeline

def main():
  # region_timeline is a dict of the format:
  # {"us-east-1": {"s3": {"date": "0000-00-00"}} 
  region_timeline = {}
  run_command(["git", "fetch", "--all"], fatal=False)
  run_command(["git", "checkout", "--", "."])
  run_command(["git", "reset", "--hard"])
  run_command(["git", "clean", "-dfx"])
  run_command(["git", "clean", "-dfX"])
  cmd = run_command(["git", "log", "--tags", "--simplify-by-decoration", "--pretty=%ad %S", "--date=format:%Y-%m-%d"])
  tags_info = cmd.stdout.split('\n')

  tags_info.reverse()
  for tag_info in tags_info:
    if tag_info == '':
      continue
    tag_date, tag_name = tag_info.split(' ')
    if 'rc' in tag_name:
      print('Skipping', tag_name)
      continue
    #print(tagDate)
    print(tag_name)

    cmd = run_command(["git", "checkout", tag_name])
    
    # At least Java SDK 1.10.51
    if os.path.exists(ENDPOINTS_JSON_1_10_51):
      region_timeline = parse_endpoints_json(region_timeline, tag_date, ENDPOINTS_JSON_1_10_51)
    # Java SDK 1.8.10 - 1.10.50
    elif os.path.exists(REGIONS_XML_1_8_10):
        region_timeline = parse_regions_xml(region_timeline, tag_date, REGIONS_XML_1_8_10)
    # Java SDK 1.7.0 - 1.8.9.1
    elif os.path.exists(REGIONS_XML_1_7_0):
      region_timeline = parse_regions_xml(region_timeline, tag_date, REGIONS_XML_1_7_0)
    # Java SDK 1.4.2 - 1.6.9
    elif os.path.exists(REGIONS_XML_1_4_2):
      region_timeline = parse_regions_xml(region_timeline, tag_date, REGIONS_XML_1_4_2)

  with open('region_timeline.json', 'w') as fd:
    json.dump(region_timeline, fd)
  print('scrape complete')

main()