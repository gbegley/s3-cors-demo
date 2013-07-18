var S3 = function () {

    var signingEndpoint = "/sd/import/s3/signed";
    var signingPutEndpoint = "/sd/import/s3/put";
    var me = this;

    var filesToLoad = [];
    var activeLoad = null;

    me.handleProgress = function(percent, statusLabel) {
    };

    me.handleComplete = function() {
    };

    var setProgress = function(percent,statusLabel) {
        me.handleProgress(percent,statusLabel);
    };

    var createCORSRequest = function (method, url) {
        var xhr = new XMLHttpRequest();
        if ("withCredentials" in xhr) {
            xhr.open(method, url, true);
        }
        else if (typeof XDomainRequest != "undefined") {
            xhr = new XDomainRequest();
            xhr.open(method, url);
        }
        else {
            xhr = null;
        }
        return xhr;
    };

    me.signKeyRequest = function(method,key,callback) {
        var url = signingEndpoint;
        url+='?method='+method+'&key=' + key ;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);

        // Hack to pass bytes through unprocessed.
        //xhr.overrideMimeType('text/plain; charset=x-user-defined');

        xhr.onreadystatechange = function (e) {
            if (this.readyState == 4 && this.status == 200) {
                //callback(decodeURIComponent(this.responseText));
                console.log(this.responseText);
                callback(this.responseText);
            }
            else if (this.readyState == 4 && this.status != 200) {
                alert('Could not contact signing endpoint\n. Status = ' + this.status);
            }
        };

        xhr.send();

    };

    /**
     * Execute the given callback with the signed response.
     */
    var executeOnSignedUrl = function(toDataSet, file, callback) {

        var url = signingPutEndpoint;
        url+='?dataset='+toDataSet+'&name=' + file.name + '&type=' + file.type;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);

        // Hack to pass bytes through unprocessed.
        xhr.overrideMimeType('text/plain; charset=x-user-defined');

        xhr.onreadystatechange = function (e) {
            if (this.readyState == 4 && this.status == 200) {
                //callback(decodeURIComponent(this.responseText));
                callback(this.responseText);
            }
            else if (this.readyState == 4 && this.status != 200) {
                setProgress(0, 'Could not contact signing endpoint. Status = ' + this.status);
            }
        };

        xhr.send();
    };

    var uploadToDataSet = function(conf) {
        executeOnSignedUrl(conf.dataset, conf.file, function (signedURL) {
            uploadToS3(conf.file, signedURL);
        });
    };

    /**
     * Use a CORS call to upload the given file to S3. Assumes the url
     * parameter has been signed and is accessible for upload.
     */
    var uploadToS3 = function (file, url) {
        console.log("Uploading file to s3: " + file.name);
        console.log("CORS URL: " + url);

        var xhr = createCORSRequest('PUT', url);
        if (!xhr) {
            setProgress(0, 'CORS not supported');
        }
        else {
            xhr.onload = function () {
                if (xhr.status == 200) {
                    setProgress(100, ' Upload completed: '+ file.name);
                } else {
                    var msg = 'Upload error: ' + xhr.status;
                    try {
                        msg += " - " + xhr.responseXML.documentElement.firstChild.nextSibling.textContent;
                    } catch (e) {
                    }
                    setProgress(0, msg);
                }
                window.setTimeout(loadNextFile,3000);
            };
            xhr.onerror = function () {
                setProgress(0, 'XHR error on '+file.name);
                window.setTimeout(loadNextFile,3000);
            };
            xhr.upload.onprogress = function (e) {
                if (e.lengthComputable) {
                    var percentLoaded = Math.round((e.loaded / e.total) * 100);
                    var message = file.name +  percentLoaded == 100 ? ' Finalizing.' : ' Uploading '+file.name+'...';
                    setProgress(percentLoaded, message);
                }
            };

            xhr.setRequestHeader('Content-Type', file.type);
            // update cors configurations on s3 bucket to restrict to specific headers.
            // xhr.setRequestHeader('x-amz-acl', 'public-read');
            xhr.send(file);
        }
    };

    me.getDataSetName = function(){
        return "corsdemo3";
    };

    var loadNextFile = function(){
        activeLoad = null;
        if(filesToLoad.length>0) {
            activeLoad = filesToLoad.shift();
            uploadToDataSet(activeLoad);
        } else {
            me.handleComplete();
        }
    };

    me.handleFileSelection = function(evt,callback) {
        setProgress(0, 'Upload started.');
        var dataset = me.getDataSetName();
        var files = evt.dataTransfer.files;
        for (var i = 0, f; f = files[i]; i++) {
            console.log("Adding file to upload queue for: "+dataset+": "+ f.name);
            filesToLoad.push({dataset:dataset,file:files[i]});
        }
        loadNextFile();
    };

};
