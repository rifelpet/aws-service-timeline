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

document.addEventListener('DOMContentLoaded', function(event) {
  loadTimeline(function(rawData) {
    var regionTimeline = rawData['ByRegion'];
    var serviceLaunchDates = rawData['ServiceLaunchDates'];
    var regionLaunchDates = rawData['RegionLaunchDates'];
    var regions = Object.keys(regionLaunchDates).sort();
    var services = Object.keys(serviceLaunchDates).sort();
    regions.forEach(function (region) {
      var option = document.createElement("option");
      var text = document.createTextNode(region);
      option.appendChild(text);
  
      var select = document.getElementById("regions");
      select.appendChild(option);
    });
    services.forEach(function (service) {
      var option = document.createElement("option");
      var text = document.createTextNode(service);
      option.appendChild(text);
  
      var select = document.getElementById("services");
      select.appendChild(option);
    });
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
          var delay = (regionDate - startDate) / 1000 / 60 / 60 / 24;
          x.push(delay)
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