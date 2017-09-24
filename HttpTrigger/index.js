module.exports = function (context, request) {
    context.bindings.outputQueueItem = request.body;
    context.done();
};