const express = require('express');

const contactsController = require('../../controllers/contacts-controllers');

const schemas = require("../../schemas/contacts-schemas");

const {validateBody} = require("../../decorators");

const router = express.Router();

router.get('/', contactsController.getAllContacts);

router.get('/:contactId', contactsController.getContactById)

router.post('/', validateBody(schemas.contactAddSchema), contactsController.addContact)

router.delete('/:contactId', contactsController.deleteContactById)

router.put('/:contactId', validateBody(schemas.contactAddSchema), contactsController.updateContactById)

module.exports = router;
