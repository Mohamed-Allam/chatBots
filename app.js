var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// registering a middleware to access all requests before route matching
server.pre((req,res,next)=>{console.log(" >>>> This is a new Request ... \n"), next();})
// Listen for messages from users 
server.post('/api/messages', connector.listen());


// Main menu
var menuItems = { 
    "Order dinner": {
        item: "orderDinner"
    },
    "Dinner reservation": {
        item: "dinnerReservation"
    },
    "Schedule shuttle": {
        item: "scheduleShuttle"
    },
    "Request wake-up call": {
        item: "wakeupCall"
    },
}

var inMemoryStorage = new builder.MemoryBotStorage();



// This is a reservation bot that has a menu of offerings.
var bot = new builder.UniversalBot(connector, [
    function(session){
        session.send("Welcome to Contoso Hotel and Resort.");
        
        session.beginDialog("mainMenu");
    }
]).set('storage', inMemoryStorage); // Register in-memory storage 

// Display the main menu and start a new request depending on user input.
bot.dialog("mainMenu", [
    function(session){
        builder.Prompts.choice(session, "Main Menu:", menuItems);
    },
    function(session, results){
        if(results.response){
            session.beginDialog(menuItems[results.response.entity].item);
        }
    }
])
.triggerAction({
    // The user can request this at any time.
    // Once triggered, it clears the stack and prompts the main menu again.
    matches: /^main menu$/i,
    confirmPrompt: "This will cancel your current request & open the Main Menu. Are you sure?"
});




// >>>>>>>>> This dialog helps the user make a dinner reservation. ----------------------- <<<<<<<<
bot.dialog('dinnerReservation', [
    function (session) {
        session.send("Welcome to the dinner reservation.");
        session.beginDialog('askForDateTime');
    },
    function (session, results) {
        session.dialogData.reservationDate = builder.EntityRecognizer.resolveTime([results.response]);
        session.beginDialog('askForPartySize');
    },
    function (session, results) {
        session.dialogData.partySize = results.response;
        session.beginDialog('askForReserverName');
    },
    function (session, results) {
        session.dialogData.reservationName = results.response;

        // Process request and display reservation details
        session.send(`Reservation confirmed. Reservation details: <br/>Date/Time: ${session.dialogData.reservationDate} <br/>Party size: ${session.dialogData.partySize} <br/>Reservation name: ${session.dialogData.reservationName}`);
        session.endDialog();
    }
])
.triggerAction({
    matches: /^dinner reserv$/i,
    confirmPrompt: "This will cancel your current request and start a Dinner Reservation Request. Are you sure?"
}).beginDialogAction('dinnerReservHelpAction', 'dinnerReservHelp', { matches: /^help$/i });

// Context Help dialog for Dinner Reserve dialog
bot.dialog('dinnerReservHelp', function(session, args, next) {
    var msg = "this is the dinner reserver specific help";
    session.endDialog(msg);
})

// Dialog to ask for a date and time
bot.dialog('askForDateTime', [
    function (session) {
        builder.Prompts.time(session, "Please provide a reservation date and time (e.g.: June 6th at 5pm)");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

// Dialog to ask for number of people in the party
bot.dialog('askForPartySize', [
    function (session) {
        builder.Prompts.text(session, "How many people are in your party?");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
])

// Dialog to ask for the reservation name.
bot.dialog('askForReserverName', [
    function (session) {
        builder.Prompts.text(session, "Who's name will this reservation be under?");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

// >>>>>>>>> This dialog helps the user make a dinner reservation. ----------------------- <<<<<<<<

// >>>>>> Dinner Ordering Request <<<<<<<<<<

// This dialog help the user order dinner to be delivered to their hotel room.
var dinnerMenu = {
    "Potato Salad - $5.99": {
        Description: "Potato Salad",
        Price: 5.99
    },
    "Tuna Sandwich - $6.89": {
        Description: "Tuna Sandwich",
        Price: 6.89
    },
    "Clam Chowder - $4.50":{
        Description: "Clam Chowder",
        Price: 4.50
    },
    "Check out": {
        Description: "Check out",
        Price: 0 // Order total. Updated as items are added to order.
    },
    "Cancel order": { // Cancel the order and back to Main Menu
        Description: "Cancel order",
        Price: 0
    }
};

// Menu: "Order dinner"
// This dialog allows user to order dinner and have it delivered to their room.
bot.dialog('orderDinner', [
    function(session){
        session.send("Lets order some dinner!");
        session.beginDialog("addDinnerItem");
    },
    function (session, results) {
        if (results.response) {
            // Display itemize order with price total.
            for(var i = 1; i < session.conversationData.orders.length; i++){
                session.send(`You ordered: ${session.conversationData.orders[i].Description} for a total of $${session.conversationData.orders[i].Price}.`);
            }
            session.send(`Your total is: $${session.conversationData.orders[0].Price}`);

            // Continue with the check out process.
            builder.Prompts.text(session, "What is your room number?");
        } 
    },
    function(session, results){
        if(results.response){
            session.dialogData.room = results.response;
            var msg = `Thank you. Your order will be delivered to room #${results.response}`;
            session.send(msg);
            session.replaceDialog("mainMenu");
        }
    }
])
.triggerAction({
    matches: /^order dinner$/i,
    confirmPrompt: "This will cancel your Home order. Are you sure?"
}).reloadAction(
    "restartOrderDinner", "Ok. Let's start over.",
    {
        matches: /^start over$/i
    }
)
.cancelAction(
    "cancelOrder", "Type 'Main Menu' to continue.", 
    {
        matches: /^cancel$/i,
        confirmPrompt: "This will cancel your order. Are you sure?"
    }
).beginDialogAction('showCartAction', 'showDinnerCart', {
    matches: /^show cart$/i,
    dialogArgs: {
        showTotal: true
    }
});

// Show dinner items in cart
bot.dialog('showDinnerCart', function(session){
    for(var i = 1; i < session.conversationData.orders.length; i++){
        session.send(`You ordered: ${session.conversationData.orders[i].Description} for a total of $${session.conversationData.orders[i].Price}.`);
    }

    // End this dialog
    session.endDialog(`Your total is: $${session.conversationData.orders[0].Price}`);
});



// Add dinner items to the list by repeating this dialog until the user says `check out`. 
bot.dialog("addDinnerItem", [
    function(session, args){
        if(args && args.reprompt){
            session.send("What else would you like to have for dinner tonight?");
        }
        else{
            // New order
            // Using the conversationData to store the orders
            session.conversationData.orders = new Array();
            session.conversationData.orders.push({ 
                Description: "Check out",
                Price: 0
            })
        }
        builder.Prompts.choice(session, "Dinner menu:", dinnerMenu);
    },
    function(session, results){
        if(results.response){
            if(results.response.entity.match(/^check out$/i)){
                session.endDialog("Checking out...");
            } 
            else if(results.response.entity.match(/^cancel/i)){
                // Cancel the order and start "mainMenu" dialog.
                session.cancelDialog(0, "mainMenu");
            }
            else {
                var order = dinnerMenu[results.response.entity];
                session.conversationData.orders[0].Price += order.Price; // Add to total.
                var msg = `You ordered: ${order.Description} for a total of $${order.Price}.`;
                session.send(msg);
                session.conversationData.orders.push(order);
                session.replaceDialog("addDinnerItem", { reprompt: true }); // Repeat dinner menu
            }
        }
    }
])
.reloadAction(
    "restartOrderDinner", "Ok. Let's start over.",
    {
        matches: /^start over$/i
    }
);

// >>>>>> End f Dinner Ordering Request <<<<<<


// Global Help

// The dialog stack is cleared and this dialog is invoked when the user enters 'help'.
bot.dialog('help', [function (session, args, next) {
    session.send(" This is The General Help")
    builder.Prompts.text(session," Press any Key To Exit")
    
   
},(session,results) => {
    session.send("You Pressed " + results.response)
        session.endDialog("Genral Help ENded");
    }])
.triggerAction({
    matches: /^help$/i,
});

bot.dialog('phonePrompt', [
    function (session, args) {
        if (args && args.reprompt) {
            builder.Prompts.text(session, "Enter the number using a format of either: '(555) 123-4567' or '555-123-4567' or '5551234567'")
        } else {
            builder.Prompts.text(session, "What's your phone number?");
        }
    },
    function (session, results) {
        var matched = results.response.match(/\d+/g);
        var number = matched ? matched.join('') : '';
        if (number.length == 10 || number.length == 11) {
            session.userData.phoneNumber = number; // Save the number.
            session.endDialogWithResult({ response: number });
        } else {
            // Repeat the dialog
            session.replaceDialog('phonePrompt', { reprompt: true });
        }
    }
]).triggerAction({
    matches: /^enter phone$/i,
});


// Genral Help While keeping teh stack
// .triggerAction({
//     matches: /^help$/i,
//     onSelectAction: (session, args, next) => {
//         // Add the help dialog to the dialog stack 
//         // (override the default behavior of replacing the stack)
//         session.beginDialog(args.action, args);
// }});

/// Normal Help Trigger which will end the current Dialog 
// .triggerAction({
//     matches: /^help$/i,
// });

// Dialog to ask for number of people in the party i.e contextual help
// bot.dialog('askForPartySize', [
//     function (session) {
//         builder.Prompts.text(session, "How many people are in your party?");
//     },
//     function (session, results) {
//        session.endDialogWithResult(results);
//     }
// ])
// .beginDialogAction('partySizeHelpAction', 'partySizeHelp', { matches: /^help$/i });

// // Context Help dialog for party size
// bot.dialog('partySizeHelp', function(session, args, next) {
//     var msg = "Party size help: Our restaurant can support party sizes up to 150 members.";
//     session.endDialog(msg);
// })

// bot.dialog('dinnerOrder', [
//     //...waterfall steps...
// ])
// .endConversationAction(
//     "endOrderDinner", "Ok. Goodbye.",
//     {
//         matches: /^cancel$|^goodbye$/i,
//         confirmPrompt: "This will cancel your order. Are you sure?"
//     }
// );