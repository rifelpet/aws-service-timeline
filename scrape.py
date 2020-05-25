#!/usr/bin/env python3
"""Scrapes the aws-sdk-java repo for region/service release timing inforation saved to"""
from datetime import datetime
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

# Inspired by:
# https://github.com/AwsGeek/aws-history https://www.awsgeek.com/pages/AWS-History/
# https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
REPO_DIR   = os.path.join(SCRIPT_DIR, 'aws-sdk-java')
REPO_URL   = 'https://github.com/aws/aws-sdk-java.git'

REGIONS_XML_1_4_2      = os.path.join(REPO_DIR, 'src/main/resources/etc/regions.xml')
REGIONS_XML_1_7_0      = os.path.join(REPO_DIR, 'src/main/resources/com/amazonaws/regions/regions.xml')
REGIONS_XML_1_8_10     = os.path.join(REPO_DIR, 'aws-java-sdk-core/src/main/resources/com/amazonaws/regions/regions.xml')
ENDPOINTS_JSON_1_10_51 = os.path.join(REPO_DIR, 'aws-java-sdk-core/src/main/resources/com/amazonaws/partitions/endpoints.json')

# Services that aren't region-specific
SERVICE_BLACKLIST = ['discovery', 'groundstation', 'health', 'route53domains', 'ce', 'budgets', 'route53', 'iam']
# Region endpoints that aren't actual AWS regions
REGION_BLACKLIST = ['aws-global', 'local', 's3-external-1', 'sandbox', 'us-east-1-regional']

def run_command(cmd, cwd=REPO_DIR, retries=5, fatal=True) -> subprocess.CompletedProcess:
    """Runs a command with retry/backoff returning the result"""
    result = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        if 'too many open files' in result.stderr and retries > 0:
            time.sleep(2.0/retries)
            return run_command(cmd, cwd, retries-1)
        print('command failed', ' '.join(cmd))
        print(result.stderr)
        if fatal:
            sys.exit(1)
    return result

def ensure_repo():
    """Ensures the aws-sdk-java git repo exists"""
    if os.path.exists(REPO_DIR):
        return
    run_command(['git', 'clone', REPO_URL], cwd=SCRIPT_DIR)
    run_command(['git', 'fetch', '--all'], fatal=False)
    run_command(['git', 'checkout', '--', '.'])
    run_command(['git', 'reset', '--hard'])
    run_command(['git', 'clean', '-dfx'])
    run_command(['git', 'clean', '-dfX'])


def parse_endpoints_json(raw_timeline, tag_date: str, filename: str):
    """Parses the endpoints.json file from 1.10.51 and newer"""
    with open(filename) as f:
        endpoint_info = json.load(f)
        for partition in endpoint_info['partitions']:
            if partition['partition'] != 'aws':
                continue
            for service, endpoints in partition['services'].items():
                service = service.replace('api.', '')
                if service in SERVICE_BLACKLIST:
                    continue
                for region in endpoints['endpoints'].keys():
                    region = region.lower()
                    if 'dualstack' in region or 'fips' in region or region in REGION_BLACKLIST:
                        continue
                    if region not in raw_timeline:
                        print('Found new region', region)
                        raw_timeline[region] = {}
                    if service not in raw_timeline[region]:
                        raw_timeline[region][service] = {'date': tag_date}
    return raw_timeline

def parse_regions_xml(raw_timeline, tag_date: str, filename: str):
    """Parses the regions.xml file from 1.8.10 to 1.10.51"""
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
                    if region not in raw_timeline:
                        print('Found new region', region)
                        raw_timeline[region] = {}
                    if service_name not in raw_timeline[region]:
                        raw_timeline[region][service_name] = {'date': tag_date}
    return raw_timeline

def main():
    """Scrapes the aws-sdk-java repo for region/service release timing inforation"""
    ensure_repo()
    # raw_timeline is a dict of the format:
    # {'us-east-1': {'s3': {'date': 'YYYY-MM-DD'}}
    raw_timeline = {}
    cmd = run_command(['git', 'log', '--tags', '--simplify-by-decoration', '--pretty=%ad %S', '--date=format:%Y-%m-%d'])

    # Skip early releases because they don't contain endpoint information
    tags_info = list(filter(lambda t: t != '' and 'rc' not in t and not re.match(r'^201[01]', t), cmd.stdout.split('\n')))

    tags_info.reverse()
    for tag_info in tags_info:
        tag_date, tag_name = tag_info.split(' ')

        print(tag_date, tag_name)

        cmd = run_command(['git', 'checkout', tag_name])

        # At least Java SDK 1.10.51
        if os.path.exists(ENDPOINTS_JSON_1_10_51):
            raw_timeline = parse_endpoints_json(raw_timeline, tag_date, ENDPOINTS_JSON_1_10_51)
        # Java SDK 1.8.10 - 1.10.50
        elif os.path.exists(REGIONS_XML_1_8_10):
            raw_timeline = parse_regions_xml(raw_timeline, tag_date, REGIONS_XML_1_8_10)
        # Java SDK 1.7.0 - 1.8.9.1
        elif os.path.exists(REGIONS_XML_1_7_0):
            raw_timeline = parse_regions_xml(raw_timeline, tag_date, REGIONS_XML_1_7_0)
        # Java SDK 1.4.2 - 1.6.9
        elif os.path.exists(REGIONS_XML_1_4_2):
            raw_timeline = parse_regions_xml(raw_timeline, tag_date, REGIONS_XML_1_4_2)


    timeline_by_region = {}
    timeline_by_service = {}
    region_launch_dates = {}
    service_launch_dates = {}

    for region in raw_timeline.keys():
        timeline_by_region[region] = {}
        for service in raw_timeline[region].keys():
            release = raw_timeline[region][service]
            service = service.replace('api.', '')
            timeline_by_region[region][service] = release
            if service not in timeline_by_service:
                timeline_by_service[service] = {}
            timeline_by_service[service][region] = release
            curr_date = datetime.strptime(release['date'], '%Y-%m-%d')

            if region not in region_launch_dates or \
                    curr_date < datetime.strptime(region_launch_dates[region], '%Y-%m-%d'):
                region_launch_dates[region] = release['date']
            if service not in service_launch_dates or \
                    curr_date < datetime.strptime(service_launch_dates[service], '%Y-%m-%d'):
                service_launch_dates[service] = release['date']

    report = {
        'ByRegion': timeline_by_region,
        'ByService': timeline_by_service,
        'ServiceLaunchDates': service_launch_dates,
        'RegionLaunchDates': region_launch_dates
    }

    with open('region_timeline.json', 'w') as f:
        json.dump(report, f)
    print('scrape complete')

main()
