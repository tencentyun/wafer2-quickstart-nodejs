var utils = require('./utils');
var constants = require('./constants');
var Session = require('./session');

/***
 * @class
 * 表示登录过程中发生的异常
 */
var LoginError = (function () {
    function LoginError(type, message) {
        Error.call(this, message);
        this.type = type;
        this.message = message;
    }

    LoginError.prototype = new Error();
    LoginError.prototype.constructor = LoginError;

    return LoginError;
})();

var noop = function noop() { };
var defaultOptions = {
    method: 'GET',
    success: noop,
    fail: noop,
    loginUrl: null,
};


var login = function login(options) {
    options = utils.extend({}, defaultOptions, options);
    console.log('login',options);
    if (!/http/.test(defaultOptions.loginUrl)) {
        options.fail(new LoginError(constants.ERR_INVALID_PARAMS, '登录错误：缺少登录地址，请通过 setLoginUrl() 方法设置登录地址'));
        return;
    }

    // 查看是否授权
    wx.getSetting({
        success: function (res) {
            if (res.authSetting['scope.userInfo']) {

                // 检查登录是否过期或存在
                wx.checkSession({
                    success: function () {
                        // 登录态未过期
                        options.success();
                    },

                    fail: function () {
                        Session.clear();

                        // 登录态已过期或不存在登录态，需重新登录
                        wx.login({
                            success: function (loginResult) {
                                options.loginParams.code = loginResult.code;
                                doLogin(options);
                            },
                            fail: function (loginError) {
                                var error = new LoginError(constants.ERR_WX_LOGIN_FAILED, '微信登录失败，请检查网络状态');
                                error.detail = loginError;
                                options.fail(error)
                            },
                        });

                    },
                });
            } else {
                var noAuthError = new LoginError(constants.ERR_LOGIN_FAILED, '登录失败，用户未授权');
                options.fail(noAuthError);
            }
        }
    });

}

var doLogin = function (options) {
    var that = this;
    console.log('doLogin',options);
    // 构造请求头，包含 code、encryptedData 和 iv
    var code = options.loginParams.code;
    var encryptedData = options.loginParams.encryptedData;
    var iv = options.loginParams.iv;
    var header = {};

    header[constants.WX_HEADER_CODE] = code;
    header[constants.WX_HEADER_ENCRYPTED_DATA] = encryptedData;
    header[constants.WX_HEADER_IV] = iv;
    console.log('jude', header);
    // 请求服务器登录地址，获得会话信息
    wx.request({
        url: options.loginUrl,
        header: header,
        method: options.method,
        data: options.data,
        success: function (result) {
            var data = result.data;

            // 成功地响应会话信息
            if (data && data.code === 0 && data.data.skey) {
                var res = data.data

                if (res.userinfo) {
                    Session.set(res);
                    options.success(res.userinfo);
                } else {
                    var errorMessage = '登录失败(' + data.error + ')：' + (data.message || '未知错误');
                    var noSessionError = new LoginError(constants.ERR_LOGIN_SESSION_NOT_RECEIVED, errorMessage);
                    options.fail(noSessionError);
                }

                // 没有正确响应会话信息
            } else {
                var noSessionError = new LoginError(constants.ERR_LOGIN_SESSION_NOT_RECEIVED, JSON.stringify(data));
                options.fail(noSessionError);
            }
        },

        // 响应错误
        fail: function (loginResponseError) {
            var error = new LoginError(constants.ERR_LOGIN_FAILED, '登录失败，可能是网络错误或者服务器发生异常');
            options.fail(error);
        },
    });
}

var setLoginUrl = function (loginUrl) {
    defaultOptions.loginUrl = loginUrl;
};

module.exports = {
    LoginError: LoginError,
    login: login,
    setLoginUrl: setLoginUrl,
};