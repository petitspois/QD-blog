/**
 * Created by qingdou on 15/2/11.
 */

var level = require('../server/config').level,

    userModel = require('../model/').user,

    postModel = require('../model/').post,

    commentModel = require('../model/').comment,

    categoryModel = require('../model/').category,

    formatDate = require('../lib/format');

//get request

module.exports = function () {

    var fusion = {};

    //index
    fusion.getHome = function* () {

        var ctx = this,
            args = ctx.query,
            page = args.p - 1 ? Math.abs(args.p) : 1,
            t = args.t,
            query = {},
            posts = null,
            total = -1;


        if (t && 'all' != t) {
            switch (t) {
                case 'top':
                    query.istop = true;
                    query.status = 1;
                    break;
                case 'good':
                    query.isgood = true;
                    query.status = 1;
                    break;
                case 'doc':
                    query.type = 'doc';
                    query.status = 1;
                    break;
                default:
                    query.theme = t;
                    query.status = 1;
            }
        }


        posts = yield postModel.getAll(query, '-istop -updatetime', page, 10, 'name type title description createtime updatetime theme'),
            total = Math.ceil((yield postModel.querycount(query)) / 10);

        yield posts.map(function* (item) {
            item.avatar = (yield userModel.get({nickname: item.name}, 'avatar')).avatar;
            item.createtime = formatDate(item.createtime, true);
            item.updatetime = formatDate(item.updatetime, true);
            return item;
        });


        //signed
        if (ctx.session.user) {
            ctx.body = yield ctx.render('index', {
                title: '首页',
                user: yield userModel.get({email: this.session.user.email}),
                posts: posts,
                t: t ? t : 'all',
                page: {
                    total: total,
                    page: page
                }
            });
        } else {
            ctx.body = yield ctx.render('index', {
                title: '首页',
                posts: posts,
                t: t ? t : 'all',
                page: {
                    total: total,
                    page: page
                }
            });
        }

    }

    //signup
    fusion.getSignup = function* () {
        this.body = yield this.render('register', {title: '注册', secondtitle: '新用户注册'});
    }
    //signin
    fusion.getSignin = function* () {
        this.body = yield this.render('login', {title: '登陆', secondtitle: '立即登陆'});
    }
    //logout
    fusion.logout = function* () {
        if (this.session.user) {
            this.session.user = null;
        }
        this.body = {
            msg: '退出成功',
            status: 1
        }
    }
    //forgot
    fusion.forgat = function* () {
        this.body = yield this.render('forgat', {title: '忘记密码', secondtitle: '找回密码？'});
    }
    //profile
    fusion.profile = function* () {
        var likes = (yield userModel.get({email: this.session.user.email}, 'watchyou')).watchyou;
        if (likes.length) {
            likes = yield userModel.getAll({_id: {$in: likes}}, '', 1, 5, '-password -role');
        }
        if (this.session.user) {
            this.body = yield this.render('profile', {
                title: '个人中心',
                user: yield userModel.get({email: this.session.user.email}, '-password'),
                likes: likes
            });
        }
    }
    //publish
    fusion.publish = function* () {
        var categories = yield categoryModel.getAll({});
        if (this.session.user) {
            this.body = yield this.render('publish', {
                title: '发布文章',
                secondtitle: '发布文章',
                user: yield userModel.get({email: this.session.user.email}),
                categories: categories
            });
        }
    }

    fusion.user = function* () {
        var data = {},
            username = this.params.name,
            oppositeUser = yield userModel.get({nickname: username}, '-password'),
            page = parseInt(this.request.body && this.request.body.page) ? Math.abs(parseInt(this.request.body.page)) : 1,
            posts = yield postModel.getAll({name: username}, '-createtime', page, 10),
            likes = (yield userModel.get({nickname: username}, 'watchyou')).watchyou,
            poststotal = yield postModel.querycount({name: username}),
            remain = poststotal - page * 10;

        //title
        data.title = username;

        //user
        if (this.session.user) {
            data.user = yield userModel.get({email: this.session.user.email}, '-password');
            //是否已经关注
            data.iswatch = ~data.user.youwatch.indexOf(oppositeUser._id);

        }

        data.opposite = oppositeUser;


        //posts
        for (var i = 0; i < posts.length; i++) {
            posts[i].avatar = (yield postModel.getAvatar({name: posts[i].name})).author.avatar;
            posts[i].createtime = formatDate(posts[i].createtime, true);
            posts[i].url = '/' + (posts[i].type || 'post') + '/' + posts[i]._id;
        }

        //data.iswatch =
        data.poststotal = poststotal;
        data.oppositeposts = posts;
        if (likes.length) {
            likes = yield userModel.getAll({_id: {$in: likes}}, '', 1, 5, '-password -role');
        }
        data.likes = likes;
        if (this.request.body && this.request.body.page) {
            this.body = {
                data: data.oppositeposts,
                extra: remain
            };
        } else {
            this.body = yield this.render('user', data);
        }

    }

    fusion.reply = function* () {

        var data = {},
            username = this.params.name,
            oppositeUser = yield userModel.get({nickname: username}, '-password'),
            page = parseInt(this.request.body && this.request.body.page) ? Math.abs(parseInt(this.request.body.page)) : 1,
            comments = yield commentModel.getAll({author: oppositeUser._id}, '-createtime', page, 10),
            likes = (yield userModel.get({nickname: username}, 'watchyou')).watchyou,
            poststotal = yield commentModel.querycount({author: oppositeUser._id}),
            remain = poststotal - page * 10;

        //title
        data.title = username;


        //user
        if (this.session.user) {
            data.user = yield userModel.get({email: this.session.user.email}, '-password');
            //是否已经关注
            data.iswatch = ~data.user.youwatch.indexOf(oppositeUser._id);
        }

        data.opposite = oppositeUser;


        //posts
        for (var i = 0; i < comments.length; i++) {
            if (comments[i].reply) {
                comments[i].avatar = (yield userModel.get({nickname: comments[i].reply}, 'avatar')).avatar;
                comments[i].obj = comments[i].reply;
                comments[i].url = ('/' + (yield postModel.get({_id: comments[i].pid})).type || '/post') + '/' + comments[i].pid + '/#' + comments[i]._id;
            } else {
                comments[i].avatar = (yield postModel.getAvatar({_id: comments[i].pid})).author.avatar;
                comments[i].obj = (yield postModel.get({_id: comments[i].pid})).title;
                comments[i].url = ('/' + (yield postModel.get({_id: comments[i].pid})).type || '/post') + '/' + comments[i].pid;
            }
            comments[i].description = comments[i].comment;
            comments[i].createtime = formatDate(comments[i].createtime, true);
        }

        data.poststotal = poststotal;
        data.oppositeposts = comments;
        if (likes.length) {
            likes = yield userModel.getAll({_id: {$in: likes}}, '', 1, 5, '-password -role');
        }
        data.likes = likes;

        if (this.request.body && this.request.body.page) {
            this.body = {
                data: data.oppositeposts,
                extra: remain
            };
        } else {
            this.body = yield this.render('userreply', data);
        }
    }


    //user follow
    fusion.follow = function* () {

        var data = {},
            username = this.params.name,
            oppositeUser = yield userModel.get({nickname: username}, '-password'),
            page = parseInt(this.request.body && this.request.body.page) ? Math.abs(parseInt(this.request.body.page)) : 1,
            watchs = yield postModel.getAll({'author': {'$in': oppositeUser.youwatch}}, '-createtime', page, 10),
            likes = (yield userModel.get({nickname: username}, 'watchyou')).watchyou,
            poststotal = yield postModel.querycount({'author': {'$in': oppositeUser.youwatch}}),
            remain = poststotal - page * 10;


        //title
        data.title = username;


        //user
        if (this.session.user) {
            data.user = yield userModel.get({email: this.session.user.email}, '-password');
            //是否已经关注
            data.iswatch = ~data.user.youwatch.indexOf(oppositeUser._id);
        }

        data.opposite = oppositeUser;

        //posts
        for (var i = 0; i < watchs.length; i++) {
            watchs[i].avatar = (yield postModel.getAvatar({name: watchs[i].name})).author.avatar;
            watchs[i].createtime = formatDate(watchs[i].createtime, true);
            watchs[i].url = '/' + (watchs[i].type || 'post') + '/' + watchs[i]._id;
        }

        //data.iswatch =
        data.poststotal = poststotal;
        data.oppositeposts = watchs;
        if (likes.length) {
            likes = yield userModel.getAll({_id: {$in: likes}}, '', 1, 5, '-password -role');
        }
        data.likes = likes;

        if (this.request.body && this.request.body.page) {
            this.body = {
                data: data.oppositeposts,
                extra: remain
            };
        } else {
            this.body = yield this.render('userwatch', data);
        }
    }


    //docs
    fusion.docs = function* () {

        //new data
        //类型为文档，状态为已发布，按时间倒序
        var newData = yield postModel.getAll({type: 'doc', status: true}, '-createtime', 1, 8),
            recommendData = yield postModel.getAll({type: 'doc', recommend: true, status: true}, '-createtime', 1, 15),
            hotData = yield postModel.getAll({type: 'doc', status: true}, '-viewByCount', 1, 5),
            developer = yield userModel.getAll({}, '-docsTotal', 1, 10);

        yield hotData.map(function*(item) {
            item.avatar = (yield userModel.get({nickname: item.name}, 'avatar')).avatar;
            return item;
        });

        //return
        this.body = yield this.render('docs',
            {
                title: '文档专辑',
                user: this.session.user,
                docsNew: newData,
                recommendData: recommendData,
                hotData: hotData,
                developer: developer
            }
        );
    }

    //docs create
    fusion.create = function* () {
        var categories = yield categoryModel.getAll({});
        this.body = yield this.render('create', {
            title: '创建文档',
            secondtitle: '创建文档',
            user: this.session.user,
            categories: categories
        });
    }

    //search
    fusion.take = function* () {
        var ctx = this,
            q = ctx.query,
            p = q.p ? parseInt(q.p) : 1,
            s = q.s ? q.s : '',
            pagination = [],
            query = {},
            pagetotal;

        if (p != p) {
            throw new Error('不是有效的页面符号');
        }

        s && (query.title = eval('/' + s + '+/i'));
        posts = yield postModel.getAll(query, '-createtime', p, 10);
        total = yield postModel.querycount(query);
        pagetotal = Math.ceil(total / 10);

        var start = p < 5 ? 2 : p - 2,
            end = p < 5 ? 7 : p + 3;
        end > pagetotal && (end = pagetotal);
        for (var i = start; i < end; i++) {
            pagination.push(i);
        }

        ctx.body = yield ctx.render('search', {
            title: '搜索',
            secondtitle: '搜索',
            content: s ? s : '',
            posts: posts,
            user: ctx.session.user ? yield userModel.get({email: ctx.session.user.email}, '') : null,
            pagination: pagination,
            extra: {
                current: p,
                pagetotal: pagetotal,
                total: total
            }
        })
    }

    fusion.del = function* () {

        var id = this.request.body && this.request.body.id,
            comment = yield commentModel.get({pid: id}, 'pid');

        if (!id) {
            this.body = {
                msg: '文章不存在',
                status: 0
            }
            return;
        }

        if (comment) {
            this.body = {
                msg: '文章内含有评论，不可以删除',
                status: 0
            }
            return;
        }

        var dData = yield postModel.byidRemove(id),

            userId = dData.author;

        //decrease level
        delLevel = 'doc' == dData.type ? level.cd : level.cp;

        yield userModel.update({_id: userId}, {$inc: {level: -delLevel}});

        //docsTotal
        yield userModel.update({_id: userId}, {$inc: {docsTotal: -1}});

        if (dData) {
            this.body = {
                msg: '删除成功',
                status: 1
            }
            return;
        } else {
            this.body = {
                msg: '删除失败',
                status: 0
            }
        }


    }

    return fusion;

}
