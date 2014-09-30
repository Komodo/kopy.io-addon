if ((typeof ko) == "undefined")
{
    ko = {};
}
ko.kopy = {};

(function() {
    const log       = ko.logging.getLogger("kopy");
    const prefs     = ko.prefs;
    const self      = this;

    const bundle    = Cc["@mozilla.org/intl/stringbundle;1"]
                        .getService(Ci.nsIStringBundleService)
                        .createBundle("chrome://kopy/locale/kopy.properties");

    this.load = function()
    {
        this.addCommandController();
    }

    this.addCommandController = function()
    {
        if ("_added" in this.addCommandController) return;
        this.addCommandController._added = true;

        var controller =
        {
            do_cmd_kopySelection: function()
            {
                self.share();
            },

            supportsCommand: function(command)
            {
                return ("do_" + command) in this;
            },

            isCommandEnabled: function(command)
            {
                var method = "is_" + command + "_enabled";
                return (method in this) ?
                        this["is_" + command + "_enabled"]() : true;
            },

            doCommand: function(command)
            {
                return this["do_" + command]();
            }
        };

        window.controllers.appendController(controller);
    }

    this.share = function(data, language)
    {
        var locale;
        var useClipboard = prefs.getBoolean("kopy_copy_to_clipboard", true);
        var showInBrowser = prefs.getBoolean("donotask_kopy_browser", true);

        if ( ! useClipboard && ! showInBrowser)
        {
            locale = bundle.GetStringFromName("could_not_share");
            ko.statusBar.AddMessage(locale, 5000, true);
            return;
        }

        locale = locale = bundle.GetStringFromName("confirm_share");
        if ( ! ko.prefs.hasPref('donotask_kopy'))
        {
            ko.prefs.setBooleanPref('donotask_kopy', false);
        }
        if (ko.dialogs.yesNo(locale, null, null, null, "kopy") == "No")
        {
            log.debug("kopy cancelled by confirmation");
            return;
        }

        if ( ! data)
        {
            var view = ko.views.manager.currentView;
            var sm = view.scimoz;
            if ( ! sm)
            {
                locale = bundle.GetStringFromName("nothing_to_share");
                ko.statusBar.AddMessage(locale, "kopy", 5000, true);
            }
            else
            {
                data = sm.selText;
                if (data == "")
                {
                    data = sm.text;
                }
                language = view.scintilla.language;
            }
        }

        if ( ! language)
        {
            language = 'null';
        }

        var params = stringify(
        {
            data: data,
            language: language,
            scheme: prefs.getStringPref("editor-scheme").replace(/\-(dark|light)$/, '.$1')
        });

        var baseUrl = ko.prefs.getString("kopy_baseurl", "http://kopy.io");
        var httpReq = new window.XMLHttpRequest({mozSystem: true});
        httpReq.open("post", baseUrl + '/documents', true);
        httpReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        httpReq.setRequestHeader("Content-length", params.length);
        httpReq.setRequestHeader("Connection", "close");
        httpReq.send(params);

        httpReq.onload = function ()
        {
            try
            {
                var key = JSON.parse(this.responseText).key;
            }
            catch (e)
            {
                var errorMsg = "kopy.io: Code sharing failed, malformed response";
                log.warn(errorMsg + ": " + this.responseText);
                ko.statusBar.AddMessage(errorMsg, "kopy", 5000, true);
            }

            var url = baseUrl + '/' + key;
            if (useClipboard)
            {
                Cc["@mozilla.org/widget/clipboardhelper;1"]
                    .getService(Ci.nsIClipboardHelper)
                    .copyString(url);
                locale = bundle.formatStringFromName("url_copied", [url], 1);
                ko.statusBar.AddMessage(locale, "kopy", 5000, true);
            }

            if ( ! ko.prefs.hasPref('donotask_kopy_browser'))
            {
                ko.prefs.setBooleanPref('donotask_kopy_browser', false);
            }
            locale = bundle.GetStringFromName("confirm_open_browser");
            if (ko.dialogs.yesNo(locale, null, null, null, "kopy_browser") == "Yes")
            {
                ko.browse.openUrlInDefaultBrowser(url);
            }
        };

        httpReq.onerror = function(e)
        {
            var errorMsg = "kopy.io: HTTP Request Failed: " + e.target.status;
            log.warn(errorMsg);
            ko.statusBar.AddMessage(errorMsg, "kopy", 5000, true);
        }
    }

    // Taken from: https://github.com/mozilla/addon-sdk/blob/master/lib/sdk/querystring.js
    function stringify(options, separator, assigner)
    {
        separator = separator || '&';
        assigner = assigner || '=';

        // Explicitly return null if we have null, and empty string, or empty object.
        if (!options)
            return '';

        // If content is already a string, just return it as is.
        if (typeof(options) == 'string')
            return options;

        let encodedContent = [];

        function escape(query)
        {
            return encodeURIComponent(query).
            replace(/%20/g, '+').
            replace(/!/g, '%21').
            replace(/'/g, '%27').
            replace(/\(/g, '%28').
            replace(/\)/g, '%29').
            replace(/\*/g, '%2A');
        }

        function add(key, val)
        {
            encodedContent.push(escape(key) + assigner + escape(val));
        }

        function make(key, value)
        {
            if (value && typeof(value) === 'object')
                Object.keys(value).forEach(function(name)
                {
                    make(key + '[' + name + ']', value[name]);
                });
            else
                add(key, value);
        }
        Object.keys(options).forEach(function(name)
        {
            make(name, options[name]);
        });
        return encodedContent.join(separator);
    }

    this.load();

}).apply(ko.kopy);
