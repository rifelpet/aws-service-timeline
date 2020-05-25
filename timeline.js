// Parse all dates into Date objects
if (window.JSON && !window.JSON.dateParser) {
  var reDate = /^(\d{4})-(\d{2})-(\d{2})$/;
 
  JSON.dateParser = function (key, value) {
      if (typeof value === 'string') {
          var a = reDate.exec(value);
          if (a)
              return new Date(value);
      }
      return value;
  };
}

function loadTimeline() {
  fetch('region_timeline.json', {cache: "force-cache"})
  .then(
    function(response) {
      if (response.status !== 200) {
        console.log('Looks like there was a problem. Status Code: ' +
          response.status);
        return;
      }

      response.text().then(function(respBody) {
        let timelineData = JSON.parse(respBody, JSON.dateParser);
        let select = document.getElementById('slice');
        let slice = select.options[select.selectedIndex].text;

        let regionTimeline = timelineData['ByRegion'];
        let serviceLaunchDates = timelineData['ServiceLaunchDates'];
        let regionLaunchDates = timelineData['RegionLaunchDates'];

        populateGraph(slice, regionTimeline, serviceLaunchDates, regionLaunchDates);
      });
    }
  )
  .catch(function(err) {
    console.log('Fetch Error', err);
  });
}

function populateGraph(slice, regionTimeline, serviceLaunchDates, regionLaunchDates) {
  let services = Object.keys(serviceLaunchDates).sort();
  let regions = Object.keys(regionLaunchDates).sort();
  let data = [];

  switch (slice) {
    case 'Region':
      services.forEach(function (service) {
        let serviceLaunchDate = serviceLaunchDates[service];
        let trace = {
          y: regions,
          name: service,
          orientation: 'h',
          marker: {
            width: 1
          },
          type: 'bar'
        };
        let x = [];
        regions.forEach(function (region) {
          let regionLaunchDate = regionLaunchDates[region];
          if (service in regionTimeline[region]) {
            // We want the difference between the date the region or service was launched (whichever is greater)
            // and the date the service was expanded into this region
            let regionServiceLaunchDate = Math.max.apply(null, [regionLaunchDate, serviceLaunchDate]);
            let regionServiceExpansionDate = regionTimeline[region][service]["date"];
            let delayWeeks = Math.floor((regionServiceExpansionDate - regionServiceLaunchDate) / 1000 / 60 / 60 / 24);
            x.push(delayWeeks);
          } else {
            // The service hasnt been expanded into this region yet
            // TODO: handle this better
            x.push(-1);
          }
        });
        trace["x"] = x;
        if (x.length > 0) {
          data.push(trace);
        }
      })
      break
    case 'Service':
      regions.forEach(function (region) {
        let regionLaunchDate = regionLaunchDates[region];

        let trace = {
          y: services,
          name: region,
          orientation: 'h',
          marker: {
            width: 1
          },
          type: 'bar'
        };
        let x = [];
        services.forEach(function (service){
          let serviceLaunchDate = serviceLaunchDates[service];
          if (service in regionTimeline[region]) {
            // We want the difference between the date the region or service was launched (whichever is greater)
            // and the date the service was expanded into this region
            let regionServiceLaunchDate = Math.max.apply(null, [regionLaunchDate, serviceLaunchDate]);
            let regionServiceExpansionDate = regionTimeline[region][service]["date"];
            let delayWeeks = Math.floor((regionServiceExpansionDate - regionServiceLaunchDate) / 1000 / 60 / 60 / 24);
            x.push(delayWeeks);
          } else {
            // The service hasnt been expanded into this region yet
            // TODO: handle this better
            x.push(-1);
          }
        });
        trace["x"] = x;
        if (x.length > 0) {
          data.push(trace);
        }
      });
      break
    }

  let layout = {
    title: {
      text: "AWS Regional Service Expansion Delay"
    },
    legend: {
      title: {
        text: "Regions"
      }
    },
    xaxis: {
      title: {
        text: "Delay (days)"
      },
      dtick: 365
    },
    showSendToCloud:false,
    yaxis: {
      categoryorder: "category descending"
    }
  };
  Plotly.newPlot('graph', data, layout, {displaylogo: false});
}

document.addEventListener('DOMContentLoaded', function() {
  loadTimeline();
})
