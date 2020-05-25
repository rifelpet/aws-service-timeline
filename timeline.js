const defaultSlice = "us-east-1";

function loadTimeline(cb) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
     cb(JSON.parse(this.responseText));
    }
  };
  xhttp.open("GET", "region_timeline.json", true);
  xhttp.send();
}

function populateDropdowns(regions, services, cb) {
  var regionSelect = document.getElementById("regions");
  regions.forEach(function (region) {
    var option = document.createElement("option");
    var text = document.createTextNode(region);
    option.appendChild(text);
    if (region === defaultSlice) {
      option.setAttribute('selected', true);
    }
    regionSelect.appendChild(option);
  });
  var serviceSelect = document.getElementById("services");
  services.forEach(function (service) {
    var option = document.createElement("option");
    var text = document.createTextNode(service);
    option.appendChild(text);
    serviceSelect.appendChild(option);
  });
  cb();
}

document.addEventListener('DOMContentLoaded', function(event) {
  loadTimeline(function(rawData) {
    var regionTimeline = rawData['ByRegion'];
    var serviceLaunchDates = rawData['ServiceLaunchDates'];
    var regionLaunchDates = rawData['RegionLaunchDates'];
    var regions = Object.keys(regionLaunchDates).sort();
    var services = Object.keys(serviceLaunchDates).sort();

    populateDropdowns(regions, services, function() {
      var data = [];
      regions.forEach(function (region) {
        if (region != 'eu-west-1') {
          return
        }
        var trace = {
          //x: [20, 14, 23],
          y: services,
          name: region,
          orientation: 'h',
          marker: {
            width: 1
          },
          type: 'bar'
        };
        x = []
        // regionServices = [];
        services.forEach(function (service){
          var startDate = serviceLaunchDates[service];
          if (service in regionTimeline[region]) {
            var regionDate = Date.parse(regionTimeline[region][service]["date"])
            var delayWeeks = (regionDate - startDate) / 1000 / 60 / 60 / 24 / 7;
            x.push(delayWeeks)
          } else {
            x.push(-100)
          }
        });
        trace["x"] = x;
        if (x.length > 0) {
          data.push(trace);
        }
      });

      Plotly.newPlot('graph', data, {showSendToCloud:true});
    })
  })
})